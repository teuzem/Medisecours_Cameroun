#!/usr/bin/env bash
# =============================================================================
# 02-installer-coolify.sh
# Installe Coolify (et Docker avec) sur le VPS prepare par le script 01.
#
# À exécuter EN ROOT, juste après 01 :
#     bash 02-installer-coolify.sh
#
# Ce script contient UNE seule commande « magique » : celle officielle de Coolify.
# Elle est commentee longuement ci-dessous pour que tu saches ce qu'elle installe
# sur TON serveur — ne jamais lancer une commande qu'on ne comprend pas.
# =============================================================================

# Arrete le script a la premiere erreur (meme principe que dans 01).
set -euo pipefail

# "noninteractive" : empeche apt/manager de poser des questions (aucun ecran
# interactif dans ce terminal). Indispensable pour une installation non suivie.
export DEBIAN_FRONTEND=noninteractive

echo "==> Verification des prerequis"

# On verifie que le script 01 a bien ete execute : sans lui, il manque peut-etre
# le swap (build qui meurt en memoire) et le pare-feu (ports 80/443 fermes :
# impossible d'obtenir un certificat Let's Encrypt plus tard).
if ! swapon --show | grep -q swap; then
  echo "    AVERTISSEMENT : aucun swap actif (free -h). Le build peut echouer avec"
  echo "    'Killed' ou 'exit code 137'. Execute d'abord : bash 01-preparer-le-vps.sh"
fi
if ! command -v ufw >/dev/null 2>&1; then
  echo "    AVERTISSEMENT : ufw absent, le pare-feu n'est pas configure."
  echo "    Execute d'abord : bash 01-preparer-le-vps.sh"
fi

echo "==> Lancement de l'installation officielle Coolify"
echo "    Duree estimee : 3 a 8 minutes (~500 Mo d'images Docker a telecharger)."
echo ""

# ---------------------------------------------------------------------------
# CE QUE FAIT EXACTEMENT `curl -fsSL ... | bash`
#
#   curl -f  : echoue (code != 0) si le serveur repond 404/500 -> pas de
#              "page d'erreur HTML" executee comme si c'etait du shell.
#   -s       : silencieux (pas de barre de progression qui pollue les logs).
#   -L       : suit les redirections (l'URL canonique de Coolify redirige).
#   | bash   : execute le script recu sur la sortie standard.
#
# Le script installe, dans cet ordre :
#   1. DOCKER ENGINE + plugin compose  : le moteur de conteneurs. Sans lui,
#      rien ne peut tourner. Il demarre au boot du serveur.
#   2. Les services INTERNES de Coolify (base de donnees, serveur d'API,
#      agent) conteneurises : c'est Coolify lui-meme, accessible sur le port 8000.
#   3. Le REVERSE PROXY (Caddy ou Traefik selon la version) : la seule porte
#      d'entree du serveur, sur les ports 80/443. C'est LUI qui demande et
#      renouvelle automatiquement les certificats Let's Encrypt quand tu
#      declareras ton domaine, et qui routera la requete vers le bon conteneur
#      (frontend sur 3000, service WebSocket sur 8081).
#   4. L'activation du service au demarrage : tout repart seul apres un reboot.
#
# Documentation officielle : https://coolify.io/docs/installation
# Documentation Docker      : https://docs.docker.com/engine/install/ubuntu/
# ---------------------------------------------------------------------------
curl -fsSL https://cdn.coolify.io/install.sh | bash

echo ""
echo "==> Installation terminee"

# ---------------------------------------------------------------------------
# DEBUT DE FIN — ce que tu dois FAIRE maintenant :
#
#  1. Le script a affiche une URL du type  http://<IP>:8000
#     et, selon la version, un mot de passe admin ou la commande
#     "sudo coolify --admin-user" pour le generer.
#     >>> Note ce mot de passe dans un gestionnaire de mots de passe.
#
#  2. LE PREMIER UTILISATEUR INSCRIT DANS L'INTERFACE DEVIENT ADMIN.
#     Il n'existe aucun compte par defaut : inscris-toi IMMEDIATEMENT avec
#     {{EMAIL_ADMIN}}. Si quelqu'un d'autre ouvre l'URL avant toi, c'est lui
#     l'administrateur (et tu devras reinstaller).
#
#  3. Ajoute l'utilisateur "deploy" au groupe docker. Ce groupe N'EXISTAIT PAS
#     au moment du script 01 (Docker vient d'etre installe), c'est pour ca que
#     cette ligne n'est pas la-bas. Sans elle, "deploy" ne peut pas parler a
#     Docker et tu devras tout faire en root.
#        usermod -aG docker deploy
#     IMPORTANT : le groupe ne s'applique qu'aux NOUVELLES sessions. Reconnecte-
#     toi en SSH ("exit" puis "ssh root@{{IP_SERVEUR}}") avant de tester.
#
#  4. Ouvre  http://{{IP_SERVEUR}}:8000  dans ton navigateur (HTTP pour
#     l'instant, c'est normal : le certificat HTTPS sera cree a l'etape 7 de
#     coolify/README.md, quand tu auras declare ton domaine).
# ---------------------------------------------------------------------------
echo "    1. Note l'URL (port 8000) et le mot de passe admin affiches ci-dessus."
echo "    2. Inscris-toi vite : le 1er inscrit = administrateur."
echo "    3. Puis execute : usermod -aG docker deploy   (et reconnecte-toi en SSH)"
echo "    4. Ouvre : http://{{IP_SERVEUR}}:8000"
echo ""
echo "    PROCHAINE ETAPE : coolify/03-creer-projet-coolify.md"
