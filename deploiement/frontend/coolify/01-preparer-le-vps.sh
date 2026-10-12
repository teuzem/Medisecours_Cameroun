#!/usr/bin/env bash
# =============================================================================
# 01-preparer-le-vps.sh
# Prépare un VPS Ubuntu vierge pour y installer Coolify.
#
# À exécuter EN ROOT :
#     sudo bash 01-preparer-le-vps.sh
#
# Ce script ne touche RIEN au projet : il sécurise et stabilise la machine.
# Il est idempotent : si tu le relances, il ne casse rien (il vérifie avant
# d'ajouter une ligne ou de créer un utilisateur).
# =============================================================================

# "set -euo pipefail" = le script s'ARRÊTE à la première erreur.
#   -e : toute commande qui renvoie un code d'erreur stoppe le script
#       (sinon on continuerait après un échec silencieux, pire que s'arrêter).
#   -u : une variable non définie est une erreur (evite d'ecraser /etc/fstab
#       avec une variable vide).
#   -o pipefail : si une commande au milieu d'un pipe echoue, tout le pipe echoue
#       (sinon seul le dernier commande compte et l'erreur disparait).
set -euo pipefail

# "noninteractive" evite TOUTE question posee par apt (type de clavier, redemarrage
# des paquets). Sans ca, le script peut bloquer sur un ecran qui n'existe pas.
export DEBIAN_FRONTEND=noninteractive

echo "==> [1/8] Mise a jour des paquets (apt update)"

# "apt update" ne met PAS a jour les logiciels : il retelecharge la LISTE des paquets
# disponibles et de leurs versions. Sans ca, "apt install" chercherait des versions
# obsoletees (voire inexistantes) dans son cache.
apt-get update -y

# Installation des outils de base dont la suite du serveur a besoin :
#   curl/wget  : telecharger des fichiers (sert a installer Coolify a l'etape 02)
#   git        : cloner le depot GitHub du projet
#   ufw        : le pare-feu (regles de ports)
#   fail2ban   : protection contre le brute-force SSH
#   ca-certificates : les racines de confiance HTTPS (sinon apt echoue sur les
#                     depot en HTTPS et Let's Encrypt echoue plus tard)
#   gnupg lsb-release unzip htop : utilitaires courants (diagnostic, archives)
apt-get install -y \
  ca-certificates curl wget git gnupg lsb-release \
  ufw fail2ban unzip htop

echo "==> [2/8] Creation d'un swap de 4 Go"

# --- POURQUOI LE SWAP ---------------------------------------------------------
# Le serveur a 2 a 8 Go de RAM. Le build d'une app Next.js (bundling webpack,
# optimisation des images, minification) peut demander plus de RAM que le serveur
# n'en a. Sans swap, le kernel Linux applique son "OOM killer" et SIGKILL le
# process au beau milieu du build : tu vois "Killed" ou "exit code 137" dans les
# logs de Coolify, sans autre explication. Le swap est une zone sur le DISQUE
# utilisee comme RAM de secours : c'est plus lent, mais le build se termine.
# 4 Go suffisent largement : c'est un filet de securite, pas un substitut a la RAM.
# -----------------------------------------------------------------------------
if ! swapon --show | grep -q '/swapfile'; then
  # "fallocate" alloue le fichier instantanement (1 seconde).
  # "dd" est le repli si fallocate n'est pas supporte sur le systeme de fichiers.
  fallocate -l 4G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=4096 status=progress

  # 600 = seul root peut lire/eecrire le swap : il contient parfois des fragments
  # de memoire (potentiellement des mots de passe en clair apres un crash).
  chmod 600 /swapfile

  # "mkswap" formate le fichier en zone d'echange ; "swapon" l'active pour la session.
  mkswap /swapfile
  swapon /swapfile

  # La ligne dans /etc/fstab rend le swap PERMANENT : sans elle, il disparait au
  # prochain redemarrage du serveur et le build echouera a nouveau une semaine
  # plus tard, sans que tu comprennes pourquoi.
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "    swap de 4 Go cree et actif"
else
  echo "    swap deja actif, rien a faire"
fi

# vm.swappiness=10 : indique au kernel d'utiliser le swap en DERNIER recours,
# quand la RAM est vraiment pleine. La valeur par defaut (60) le pousse a y
# deplacer les pages trop tot, ce qui ralentit tout le serveur pour rien.
sysctl -w vm.swappiness=10 >/dev/null
grep -q 'vm.swappiness' /etc/sysctl.d/99-swap.conf 2>/dev/null \
  || echo 'vm.swappiness=10' > /etc/sysctl.d/99-swap.conf

echo "==> [3/8] Configuration du pare-feu UFW"

# UFW = "Uncomplicated Firewall", la couche simple autour d'iptables.
# On part du principe "tout est ferme, on ouvre ce qui sert" : c'est la seule
# posture correcte sur un serveur public, sinon n'importe qui peut scanner tes ports.
ufw --force reset >/dev/null   # on repart de zero (utile si tu relances le script)
ufw default deny incoming      # BLOQUE tout ce qui arrive de l'exterieur
ufw default allow outgoing     # AUTORISE tout ce qui sort (les serveurs ont besoin
                               # de sortir pour telecharger paquets et certificats)

# Ports ouverts, avec la raison de chacun :
#   22   = SSH. Si tu le fermes, tu perds l'acces au serveur. NE LE FERME PAS.
#   80   = HTTP. Traefik/Caddy en a besoin pour la validation "HTTP-01" de
#          Let's Encrypt (le challenge arrive en HTTP avant d'y avoir un certificat).
#   443  = HTTPS. C'est le port sur lequel les visiteurs arrivent vraiment.
#   8000 = interface web de Coolify. On l'ouvre pour la premiere configuration
#          (http://{{IP_SERVEUR}}:8000) ; une fois le domaine en HTTPS, tu peux
#          refermer ce port — cf. la remarque en bas.
#   6002 = terminal web de Coolify (la console dans le navigateur qui permet
#          d'ouvrir un shell dans un conteneur sans SSH).
# Documentation officielle : https://coolify.io/docs/installation
ufw allow 22/tcp   comment 'SSH'
ufw allow 80/tcp   comment 'HTTP + challenge Let'"'"'s Encrypt'
ufw allow 443/tcp  comment 'HTTPS (trafic des visiteurs)'
ufw allow 8000/tcp comment 'Interface web Coolify'
ufw allow 6002/tcp comment 'Terminal web Coolify'

# --force : on ne demande pas "Command may disrupt existing ssh connections. Proceed with operation (y|n) ?"
#           car en script non-interactif, cette question tue la session en cours.
# IMPORTANT : on n'active le pare-feu qu'APRES avoir ouvert le 22, sinon on se
# couvre immediatement l'acces SSH (le seul port deja ouvert par defaut etant
# ecrase par "default deny incoming").
ufw --force enable
echo "    regles :"
ufw status numbered | sed 's/^/      /'

echo "==> [4/8] Installation et activation de fail2ban"

# fail2ban lit les journaux d'authentification SSH, compte les echecs, et BANNIT
# l'adresse IP source apres "maxretry" essais. Concretement : un bot qui essaie
# 10 000 mots de passe est bloque au bout de 5 tries pendant 1 heure au lieu
# d'avoir 10 000 essais.
cat > /etc/fail2ban/jail.local <<'EOF'
[DEFAULT]
# duree du bannissement
bantime  = 1h
# fenetre de comptage des echecs
findtime = 10m
# nombre d'echecs avant bannissement
maxretry = 5
# Ubuntu 24.04 n'ecrit plus /var/log/auth.log par defaut : fail2ban doit lire
# le journal systemd ("journalctl -u ssh") — sinon la jail reste silencieusement
# inactive et tu crois etre protege alors que tu ne l'es pas.
backend  = systemd

[sshd]
enabled = true
EOF
systemctl enable --now fail2ban
echo "    $(fail2ban-client status sshd 2>/dev/null | tr '\n' ' ' | sed 's/  */ /g')"

echo "==> [5/8] Fuseau horaire Europe/Paris"

# Sans ca, le serveur est en UTC : les logs, les dates de "derniere connexion"
# et les cron jobs sont decales d'une heure (2 en ete). Quand tu chercheras
# "qu'est-ce qui s'est passe a 14h", tu liras 12h ou 16h. Ca rend le
# depannage inutilement douloureux.
timedatectl set-timezone Europe/Paris
timedatectl set-ntp true    # synchronisation automatique de l'horloge (NTP)

echo "==> [6/8] Creation de l'utilisateur 'deploy'"

# POURQUOI ne pas rester en root ?
# Une commande ratée en root est irréversible : "rm -rf" ou un "apt upgrade" mal
# ciblé peut rendre le serveur injouable. L'utilisateur "deploy" a les droits
# sudo, donc il peut tout faire, mais il faut LE DEMANDER (et c'est journalisé).
if ! id deploy >/dev/null 2>&1; then
  # -m  : cree le dossier personnel /home/deploy
  # -s  : lui donne bash (sinon "nologin" : impossible d'ouvrir de session)
  useradd -m -s /bin/bash deploy
  echo "    utilisateur cree"
else
  echo "    utilisateur deja present"
fi

# Ajoute deploy au groupe sudo (capacite de demander les droits root).
usermod -aG sudo deploy

# Passe en sudo SANS mot de passe pour cet utilisateur :
#   - les scripts de deploiement tapent "sudo ..." et ne peuvent pas rester bloques
#     en attendant une saisie qui n'arrivera jamais ;
#   - ca reste auditable : sudo ecrit quand meme dans /var/log/auth.log.
echo 'deploy ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/deploy
# 440 = le fichier doit etre LU par root et le groupe sudo, jamais ecrit :
# un fichier sudoers mal forme peut BLOQUER TOUT sudo (y compris le tien).
chmod 440 /etc/sudoers.d/deploy
visudo -cf /etc/sudoers.d/deploy >/dev/null   # verifie la syntaxe avant de laisser passer

echo "==> [7/8] Durcissement de la configuration SSH"

# =========================================================================
#  ⚠️  MISE EN GARDE : NE JAMAIS SE VERROUILLER
#  Ce bloc modifie /etc/ssh/sshd_config. Si tu fais une faute de frappe ici et
#  que tu rechargez sshd, ton prochain SSH sera REFUSE : plus d'acces au serveur
#  (sauf via la console vnc du panel Contabo, souvent payante).
#
#  PROCEDURE OBLIGATOIRE :
#   1. Garde ta session SSH actuelle ouverte (fenetre 1).
#   2. Ouvre une SECONDE fenetre et connecte-toi :  ssh root@{{IP_SERVEUR}}
#   3. C'est seulement dans la fenetre 2 que tu executes ce script.
#   4. Teste une TROISIEME connexion depuis la fenetre 1 AVANT de refermer quoi
#      que ce soit. Elle doit marcher. Sinon : "rm /etc/ssh/sshd_config.d/60-durcissement.conf
#      && systemctl reload ssh" depuis la fenetre 2.
# =========================================================================

# Sauvegarde horodatee : c'est ton seul retour arriere.
cp /etc/ssh/sshd_config "/etc/ssh/sshd_config.bak.$(date +%Y%m%d-%H%M%S)"

# Sur Ubuntu 24.04, sshd lit /etc/ssh/sshd_config PUIS les *.conf de
# /etc/ssh/sshd_config.d/ par ordre alphabetique (la derniere valeur gagne).
# On ecrit donc un fichier dedie au lieu de modifier le fichier principal :
# le fichier d'origine reste intact et la desinstallation est un simple "rm".
cat > /etc/ssh/sshd_config.d/60-durcissement.conf <<'EOF'
# Nombre maximum d'essais d'authentification par connexion. Au-dela, sshd coupe
# la session — ca ralentit considerablement le brute-force.
MaxAuthTries 3

# Delai avant de couper une connexion qui ne s'est jamais authentifiee.
# Par defaut 120s : un attaquant peut tenir 120 ouvertures simultanees pour
# occuper les slots de sshd. 30s suffit largement pour un mot de passe copie-colle.
LoginGraceTime 30

# L'X11 forwarding (affichage d'applications graphiques du serveur sur ton PC)
# est inutile ici et represente une surface d'attaque en plus.
X11Forwarding no

# PasswordAuthentication yes
# ---------------------------------------------------------------------------
# ⚠️  OPTION NON ACTIVE PAR DEFAUT, par prudence.
# Desactiver la connexion par mot de passe est FORTEMENT recommande... mais
# UNIQUEMENT une fois ta cle SSH installee, sinon tu perds l'acces.
# Procedure, en resume, une fois ta cle en place et TESTEE :
#   1. genere la cle :        ssh-keygen -t ed25519 -C "deploiement-{{NOM_PROJET}}"
#   2. copie-la :             ssh-copy-id root@{{IP_SERVEUR}}
#   3. TESTE une nouvelle connexion SANS mot de passe (fenetre 2).
#   4. SEULEMENT LA : remplace ci-dessous "PasswordAuthentication yes" par
#      "PasswordAuthentication no" et relance : systemctl reload ssh
# ---------------------------------------------------------------------------
EOF

# "sshd -t" VERIFIE la syntaxe de la config sans l'appliquer.
# C'est l'etape qui te sauve : si la config est invalide, ce test echoue et le
# script s'arrete AVANT de recharger sshd, donc ta connexion reste vivante.
if sshd -t; then
  systemctl reload ssh || systemctl reload sshd
  echo "    SSH durci et recharge (syntaxe validee par 'sshd -t')"
else
  echo "    !! configuration SSH invalide : rien n'a ete recharge, connexion preservee"
  exit 1
fi

echo "==> [8/8] Recapitulatif"

# "docker" n'existe PAS ENCORE (il sera installe par 02-installer-coolify.sh).
# C'est pour ca qu'on n'ajoute pas deploy au groupe docker ici : "usermod -aG docker deploy"
# echouerait sur un groupe inexistant. On le signale pour l'etape suivante.
cat <<EOF

==================================================
 VPS prepare. A ce stade :
   - Utilisateur : deploy  (sudo sans mot de passe)
   - Swap actif   : $(free -h | awk '/Swap/{print $2}')
   - Pare-feu     : 22 (SSH), 80 (HTTP), 443 (HTTPS),
                    8000 (UI Coolify), 6002 (terminal web)
   - SSH durci    : MaxAuthTries 3, LoginGraceTime 30
     >>> AVANT DE REFERMER TA SESSION 1 : ouvre une
     >>> 2e fenetre et teste  ssh root@{{IP_SERVEUR}}

 PROCHAINE ETAPE :
     bash 02-installer-coolify.sh
 PUIS, une fois Docker installe :
     usermod -aG docker deploy
==================================================
EOF
