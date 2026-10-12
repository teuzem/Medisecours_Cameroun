#!/usr/bin/env bash
# 01-securiser-le-vps.sh — première mise en sécurité d'Ubuntu 24.04 LTS
#
# À LANCER : en root, sur le VPS, une seule fois, juste après la première connexion.
#   chmod +x 01-securiser-le-vps.sh && ./01-securiser-le-vps.sh
#
# Ce que ce script change, et POURQUOI (dans l'ordre) :
#   1. mises à jour système        → un serveur non patché est compromis en jours
#   2. paquets de base             → curl (téléchargements), ufw (pare-feu),
#                                    fail2ban (anti force brute), unattended-upgrades
#                                    (correctifs de sécurité automatiques)
#   3. swap si RAM < 4 Go          → sans swap, une base qui déborde est tuée par le
#                                    noyau (OOM killer) et ton conteneur redémarre
#   4. pare-feu UFW                → seuls 22 (SSH), 80 et 443 restent joignables
#   5. fail2ban                    → bannit une IP après 5 mots de passe erronés
#   6. utilisateur `deploy`        → on ne travaille JAMAIS en root au quotidien
#   7. durcissement SSH            → désactive l'auth par mot de passe (clé only),
#                                    MAIS seulement après ta confirmation explicite
#
# ⚠ Ne l'exécute JAMAIS à distance derrière un unique VPN instable : si l'auth par
#   mot de passe est coupée sans clé SSH installée, le serveur devient inaccessible.
set -euo pipefail
# set -e : stoppe au PREMIER échec (pas de poursuite sur un système à moitié à jour)
# set -u : toute variable non définite = erreur, pas de valeur silencieuse vide
# set -o pipefail : si une commande au milieu d'un pipe échoue, tout le pipe échoue

echo "1/7 Mises a jour du systeme "
export DEBIAN_FRONTEND=noninteractive   # pas de question interactive (zone de fuseau horaire…)
apt-get update
apt-get upgrade -y

echo "2/7 Paquets essentiels"
apt-get install -y \
    curl \
    ufw \
    fail2ban \
    unattended-upgrades \
    openssh-server \
    sudo
# unattended-upgrades = installe SEULEMENT les correctifs marqués de sécurité,
# sans intervention : sur un VPS, c'est la différence entre « patché » et « volé ».

echo "3/7 Swap (memoire d'echange)"
# Règle : si la RAM totale < 4 Go ET qu'il n'y a pas déjà de swap, on en cree 2 Go.
# Sans swap, Linux préfère TUER un processus (ici : ta base de données) plutôt que
# de ralentir — d'où les redémarrages en boucle des conteneurs sur les petits VPS.
MEM_KO=$(awk '/MemTotal/ {print $2}' /proc/meminfo)
SWAP_KO=$(awk '/SwapTotal/ {print $2}' /proc/meminfo)
if [ "$MEM_KO" -lt 4194304 ] && [ "$SWAP_KO" -eq 0 ]; then
    # fallocate = création instantanée d'un fichier vide (beaucoup plus rapide que dd)
    fallocate -l 2G /swapfile
    chmod 600 /swapfile        # seuls root peut le lire : contient de la mémoire vive
    mkswap /swapfile            # formatage en espace d'échange
    swapon /swapfile            # activation
    # /etc/fstab = "monte ce fichier à CHAQUE démarrage", sinon la swap disparaît
    # au prochain reboot et le problème revient.
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    # vm.swappiness=10 : n'utilise la swap qu'en dernier recours (défaut : 60,
    # beaucoup trop agressif pour une base qui doit rester en RAM).
    echo 'vm.swappiness=10' > /etc/sysctl.d/99-swap.conf
    echo "[OK] Swap de 2 Go cree (RAM detectee : $((MEM_KO / 1024)) Mo)."
else
    echo "[--] Swap inutile : RAM $((MEM_KO / 1024)) Mo, swap existante $((SWAP_KO / 1024)) Mo."
fi

echo " 4/7 Pare-feu UFW "
# On part d'une politique REFUS par defaut : tout ce qui n'est pas autorisé
# explicitement est bloqué. C'est l'inverse du "tout ouvert" hérité des anciens
# hébergeurs, et c'est ce qui protège ta base des scanners Internet.
ufw default deny incoming
ufw default allow outgoing
# 22/tcp : SSH. ATTENTION : autorise-le AVANT d'activer le pare-feu, sinon tu es
# coupé immédiatement (UFW refuse la session en cours à l'activation).
ufw allow 22/tcp comment 'SSH - acces administratif'
# 80/tcp : HTTP, uniquement pour la redirection vers HTTPS et le challenge certbot.
ufw allow 80/tcp comment 'HTTP - redirection HTTPS + challenge Let'\''s Encrypt'
# 443/tcp : HTTPS, le vrai port de production.
ufw allow 443/tcp comment 'HTTPS - trafic public de l application'
# Activation avec -y car l'activation coupe TOUTES les connexions non autorisees
# (et demande confirmation a l'habitude).
ufw --force enable
ufw status verbose
echo "[OK] Pare-feu actif : seuls 22, 80 et 443 sont ouverts vers l exterieur."

echo "5/7 fail2ban (protection SSH)"
# fail2ban lit /var/log/auth.log, compte les echecs de connexion, et bannit l'IP
# via ufw apres 5 tentatives ratees en 10 minutes.
install -d -m 0750 /var/log/fail2ban   # dossier attendu par le service
cat > /etc/fail2ban/jail.local <<'F2B'
[DEFAULT]
# bantime = 10 minutes (échec ponctuel : l'utilisateur a peut-être fait une faute)
bantime  = 10m
# findtime = fenetre de comptage
findtime = 10m
maxretry = 5
# banaction = ufw (et non iptables, souvent absent ou remplacé sur Ubuntu 24.04)
banaction = ufw

[sshd]
enabled = true
port    = ssh
logpath = %(sshd_log)s
F2B
systemctl enable fail2ban
systemctl restart fail2ban
sleep 3
fail2ban-client status sshd || echo "[ATTENTION] fail2ban tourne peut-etre encore au démarrage (rejoue: fail2ban-client status)"
echo "[OK] fail2ban actif."

echo " 6/7 Utilisateur 'deploy' "
if id deploy >/dev/null 2>&1; then
    echo "[--] L'utilisateur deploy existe deja."
else
    # adduser (Debian) cree le home + le mot de passe ; --disabled-password :
    # on ne lui donne PAS de mot de passe, il utilisera la cle SSH (etape 7).
    adduser --disabled-password --gecos "Deploiement" deploy
fi
usermod -aG sudo deploy
# echo dans /etc/sudoers.d = droits sudo SANS mot de passe pour les commandes de
# deploiement. Le docker group est ajoute aussi : c'est lui qui autorise l'execution
# de `docker` (voir 02-installer-docker.sh).
echo 'deploy ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/deploy
chmod 0440 /etc/sudoers.d/deploy   # 0440 = lu par root et sudo, pas modifiable par un autre
usermod -aG docker deploy
echo "[OK] Utilisateur 'deploy' cree avec les droits sudo."

echo "7/7 Durcissement SSH"
echo ""
echo "  ################################################################"
echo "  #  AVANT DE CONTINUER : OUVRE UNE DEUXIEME FENETRE SSH MAINTENANT"
echo "  #  (nouveau terminal -> ssh root@$(hostname -I | awk '{print $1}'))"
echo "  #                                                            "
echo "  #  Pourquoi : l option suivante desactive l auth par MOT DE PASSE."
echo "  #  Si ta cle SSH nest pas encore installee ET que tu fermes ta"
echo "  #  seule session, le serveur devient INACCESSIBLE (il faudra la"
echo "  #  console VNC de ton hebergeur pour revenir en arriere)."
echo "  ################################################################"
echo ""
printf "Tapez 'oui' pour desactiver l'auth par mot de passe SSH (autre reponse = on saute) : "
read -r REPONSE
if [ "$REPONSE" = "oui" ]; then
    # Dossier de configuration fragmentee : Ubuntu 24.04 lit /etc/ssh/sshd_config.d/*.conf
    # Le fichier numero 90 passe APRÈS les autres (ordre alphabetique) : nos options
    # l'emportent sur celles de l image.
    cat > /etc/ssh/sshd_config.d/90-durcissement.conf <<'SSH'
# Genere par 01-securiser-le-vps.sh
# PasswordAuthentication no : plus de connexion par mot de passe, seule la cle
#   SSH est acceptee. Les brute-force SSH (des millions de mots de passe/minute)
#   deviennent inutiles contre ce serveur.
# PermitRootLogin prohibit-password : root ne peut se connecter QU'AVEC UNE CLE,
#   jamais avec un mot de passe ni de session interactive.
# X11Forwarding no : le transfert d'affichage graphique ne sert a rien sur un VPS
#   et ajoute de la surface d attaque.
PasswordAuthentication no
PermitRootLogin prohibit-password
X11Forwarding no
SSH
    # Test de syntaxe AVANT application : un sshd_config invalide = SSH refuse de
    # demarrer au prochain reboot, et tu perds l acces.
    if sshd -t; then
        systemctl reload ssh || systemctl reload sshd
        echo "[OK] Auth par mot de passe desactivee. VERIFIE ta 2e session avant de fermer la premiere !"
    else
        rm -f /etc/ssh/sshd_config.d/90-durcissement.conf
        echo "[ERREUR] Configuration SSH invalide, fichier retire, aucune modification appliquee."
        exit 1
    fi
else
    echo "[--] Etape sautee : l auth par mot de passe reste active. A faire plus tard,"
    echo "     une fois ta cle SSH installee : ssh-copy-id root@IP puis relance ce script."
fi

echo ""
echo "Termine"
echo "Prochaine etape : ./02-installer-docker.sh"
