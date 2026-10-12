#!/usr/bin/env bash
# 04-demarrer-avec-docker-compose.sh — construction + démarrage + contrôle
#
# À LANCER : en root (ou avec le groupe docker), sur le VPS, depuis la racine du
# projet (le dossier qui contient docker/).
#   chmod +x 04-demarrer-avec-docker-compose.sh
#   ./vps/04-demarrer-avec-docker-compose.sh
# ou, si tu es déjà dans docker/ :
#   ../vps/04-demarrer-avec-docker-compose.sh
#
# Ce que fait ce script, et POURQUOI chaque étape existe :
#   1. trouver docker/docker-compose.yml et docker/.env
#      → sans .env, compose s'arrête avec un message cryptique sur une variable
#        manquante ; le chercher soi-même évite le "no configuration file provided"
#   2. `up -d --build`  → -d = détaché (la commande rend la main, les conteneurs
#      tournent en arrière-plan) ; --build = RECONSTRUIRE les images, sinon ton
#      nouveau code n'est jamais compilé (c'est la panne n°1 des "mises à jour
#      qui ne prennent pas")
#   3. attendre les healthchecks → « démarré » ≠ « prêt » : une base met ~10 s à
#      accepter des connexions, une API Java 40 s à monter son contexte
#   4. afficher `ps` + les logs → si ça a échoué, la cause est à l'écran, sans
#      avoir à deviner les bonnes commandes
set -euo pipefail

# Localisation des fichiers (tolère les deux cas de figure)
# `--project-directory` = dossier depuis lequel compose résout les chemins
# relatifs (.env, context: .., env_file: .env). Il DOIT être le dossier docker/.
DEBUT="${1:-$(pwd)}"
if [ -f "${DEBUT}/docker/docker-compose.yml" ]; then
    DOSSIER_DOCKER="${DEBUT}/docker"          # lancement depuis la racine du projet
elif [ -f "${DEBUT}/docker-compose.yml" ]; then
    DOSSIER_DOCKER="${DEBUT}"                 # lancement depuis docker/
else
    echo "[ERREUR] docker/docker-compose.yml introuvable depuis : ${DEBUT}"
    echo "         Lance ce script depuis la RACINE du projet, ou passe le chemin :"
    echo "           ./vps/04-demarrer-avec-docker-compose.sh /chemin/du/projet"
    exit 1
fi
COMPOSE_FILE="${DOSSIER_DOCKER}/docker-compose.yml"
ENV_FILE="${DOSSIER_DOCKER}/.env"
# Raccourci : toutes les commandes compose de ce script réutilisent ces 3 options.
C="docker compose --file ${COMPOSE_FILE} --project-directory ${DOSSIER_DOCKER} --env-file ${ENV_FILE}"

echo "=== 1/4 Pre-requis ==="
echo "[OK] compose : ${COMPOSE_FILE}"

if [ ! -f "$ENV_FILE" ]; then
    # .env = les vrais mots de passe et les ports. docker-compose.yml les référence
    # (${MOT_DE_PASSE_DB}, ${PORT_BACKEND}…) : sans lui, compose s'arrête sur la
    # première variable manquante (erreur "required variable ... is missing").
    echo "[ERREUR] Fichier .env introuvable : ${ENV_FILE}"
    echo "         Cree-le depuis le modele, puis remplace chaque {{...}} et chaque"
    echo "         CHANGE_ME :"
    echo "           cp ${ENV_FILE}.example ${ENV_FILE} && nano ${ENV_FILE}"
    echo "         Generation des secrets : openssl rand -hex 32 (mot de passe)"
    echo "                                  openssl rand -base64 48 (secret applicatif)"
    exit 1
fi
echo "[OK] env   : ${ENV_FILE}"

# Vérifie que les placeholders des FICHIERS DE CONFIG ont bien été remplacés.
# Ce piège classique : .env est rempli mais docker-compose.yml contient encore
# {{DOMAINE}} → le conteneur démarre avec une URL fausse, ou compose plante.
# On regarde les DEUX fichiers, car .env passe par une recherche/remplacement
# manuelle au même titre que le reste.
# `^[^#]*{{` = on ignore les COMMENTAIRES (les explications des modèles mentionnent
# elles aussi {{DOMAINE}}...) : seules les lignes actives comptent.
for FICHIER_CIBLE in "$ENV_FILE" "$COMPOSE_FILE"; do
    if grep -q '^[^#]*{{' "$FICHIER_CIBLE" 2>/dev/null; then
        echo "[ATTENTION] Des placeholders {{...}} subsistent dans ${FICHIER_CIBLE} :"
        grep -n '^[^#]*{{' "$FICHIER_CIBLE" | head -5
        echo "         Remplace-les (cf. 'Table des valeurs a personnaliser') avant de continuer."
    fi
done

echo " 2/4 Construction et demarrage "
$C up -d --build

echo " 3/4 Attente des healthchecks (jusqu a 120 secondes) "
# Un conteneur "Started" n'est pas forcément "Ready" : le healthcheck passe à
# healthy une fois la commande de santé réussie. On attend, sinon la vérification
# suivante échouerait pour rien.
ATTENTE_MAX=120
ATTENTE=0
while [ "$ATTENTE" -lt "$ATTENTE_MAX" ]; do
    # .State = running/exited/restarting ; .Health = healthy/starting/unhealthy/<vide>
    ETATS=$($C ps --format '{{.State}}|{{.Health}}' 2>/dev/null || true)
    if echo "$ETATS" | grep -qE 'exited|dead|restarting'; then
        echo "[ERREUR] Un conteneur est exited/dead/restarting des l initialisation."
        break
    fi
    if echo "$ETATS" | grep -q 'unhealthy'; then
        echo "[ERREUR] Un conteneur est passe en unhealthy."
        break
    fi
    if echo "$ETATS" | grep -q 'starting'; then
        sleep 5
        ATTENTE=$((ATTENTE + 5))
        printf '  ... %ss\n' "$ATTENTE"
    else
        echo "[OK] Tous les conteneurs sont prets apres ${ATTENTE}s."
        break
    fi
done
if [ "$ATTENTE" -ge "$ATTENTE_MAX" ]; then
    echo "[ATTENTION] Certains conteneurs ne sont pas encore healthy (120s ecoulees)."
fi

echo "4/4 Etat et logs "
$C ps

echo ""
echo " 50 dernieres lignes de log (backend, frontend, db) "
for SERVICE in backend frontend db; do
    echo ""
    echo "### ${SERVICE}"
    $C logs --tail=50 "$SERVICE" 2>/dev/null || echo "(service absent : profil non actif ou mal nomme)"
done

echo ""
echo "Resultat"
echo "  - Si tout est 'Up (healthy)' : passe a l etape 6 de vps/README.md (verifications HTTPS)."
echo "  - Si un conteneur est 'unhealthy' ou 'restarting' : la panne est dans les logs ci-dessus."
echo "    Depannage : docker/README.md section 'Depannage' et vps/README.md section 'Depannage',"
echo "    ou directement :  docker inspect --format='{{json .State.Health}}' <conteneur>"
echo "  - Erreur 'port is already allocated' : sudo ss -ltnp | grep <port>  (cf. dep. panne 2)"
echo "  - Erreur 'permission denied ... docker.sock' : exit + reconnexion SSH (cf. dep. panne 1)"
