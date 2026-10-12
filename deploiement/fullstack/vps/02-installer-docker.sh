#!/usr/bin/env bash
# 02-installer-docker.sh — Docker Engine 27+ et le plugin docker compose v2
#
# À LANCER : en root, sur le VPS, après 01-securiser-le-vps.sh.
#   chmod +x 02-installer-docker.sh && ./02-installer-docker.sh
#
# Pourquoi le script officiel `get.docker.com` plutôt qu'un simple
# `apt install docker.io` :
#   - docker.io du dépôt Ubuntu est une version qui LAGUE de plusieurs versions
#     derrière (pas de correctifs récents) ;
#   - il installe AUSSI docker buildx et le plugin `docker compose` v2, sans
#     lesquels `docker compose up` ne fonctionne pas.
# Référence officielle : https://docs.docker.com/engine/install/ubuntu/
#
# ⚠ On installe `docker compose` (plugin v2, commande SANS trait d'union).
#   L'ancien `docker-compose` (binaire v1, avec trait d'union) est abandonné
#   depuis 2023, n'est plus maintenu, et ne sait pas lire une partie de ce
#   template (profiles, healthcheck avancés). Ne l'installe JAMAIS.
set -euo pipefail

echo " 1/4 Installation de Docker (script officiel) "
# -fsSL : -f en cas d'erreur HTTP, -s progressif, -S message d'erreur, -L suivre
# les redirections (le script est servi depuis download.docker.com).
# Le pipe vers `sh` est le moyen recommandé par Docker ; c'est le SEUL moment du
# déploiement où l'on exécute un script téléchargé — vérifie l'URL : elle est
# bien https://docs.docker.com/ et get.docker.com (officiel Docker, Inc.).
curl -fsSL https://get.docker.com | sh
# Le script s'arrête tout seul si le système n'est pas pris en charge (il détecte
# Ubuntu 24.04 et choisit le bon dépôt).

echo "2/4 Verification"
docker --version
# Sortie attendue : Docker version 27.x.x, build ...
docker compose version
# Sortie attendue : Docker Compose version v2.x.x
if ! docker compose version >/dev/null 2>&1; then
    echo "[ERREUR] Le plugin docker compose v2 est absent. Relance: apt-get install docker-compose-plugin"
    exit 1
fi
if command -v docker-compose >/dev/null 2>&1; then
    echo "[ATTENTION] Un ancien binaire 'docker-compose' (v1) est present. NE L UTILISE PAS :"
    echo "            il est abandonne et ne comprend pas ce template. Supprime-le :"
    echo "            apt-get remove docker-compose"
fi

echo " 3/4 Groupe 'docker' pour l'utilisateur courant "
# Sans cette ligne, il faudra `sudo` devant CHAQUE commande docker, et les scripts
# suivants échoueraient avec "permission denied while trying to connect to the
# Docker daemon socket". Le groupe docker = les droits root sur le daemon Docker :
# c'est volontairement un privilège, d'où la mise en garde ci-dessous.
TARGET_USER="${SUDO_USER:-${LOGNAME:-root}}"
usermod -aG docker "$TARGET_USER"
echo "[OK] Utilisateur '$TARGET_USER' ajoute au groupe docker."
echo "     >>> DECONNEXION/RECONNEXION REQUISE : le groupe ne s'applique qu'au"
echo "     >>> moment de l'ouverture de la session SSH. Ferme puis rouvre ta fenetre :"
echo "     >>>   exit  &&  ssh root@{{IP_SERVEUR}}"
echo "     >>> Sans cela, 'docker ps' affiche 'permission denied' malgre le groupe."

echo "4/4 Gel des paquets Docker (eviter les mises a jour cassantes)"
# apt-mark hold = "ne mets JAMAIS ce paquet à jour automatiquement". Sans ça,
# un unattended-upgrades peut monter docker-ce d'une version mineure à l'autre
# pendant la nuit, et le daemon ne redémarre pas proprement : tes conteneurs sont
# trouvés "restarting" au réveil. Les mises à jour Docker se font à la main, à un
# moment où tu peux surveiller.
apt-mark hold \
    docker-ce \
    docker-ce-cli \
    containerd.io \
    docker-buildx-plugin \
    docker-compose-plugin
# Si Docker doit être mis à jour plus tard :
#   apt-mark unhold <paquet> && apt-get install --only-upgrade <paquet> && apt-mark hold <paquet>

echo ""
echo "Termine"
echo "Verifier :  docker ps     (doit repondre SANS sudo, apres reconnexion)"
echo "Prochaine etape : ./03-certbot-https.sh   (apres avoir pointe le DNS, cf. vps/README.md etape 5)"
