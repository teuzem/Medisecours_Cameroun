#!/usr/bin/env bash
# 03-certbot-https.sh — certificat Let's Encrypt + renouvellement automatique
#
# À LANCER : en root, sur le VPS.
#   chmod +x 03-certbot-https.sh && ./03-certbot-https.sh                # mode nginx (recommandé)
#   ./03-certbot-https.sh --webroot      # nginx absent ou config non posée
#   ./03-certbot-https.sh --standalone   # aucun service sur le port 80
#
# PRÉ-REQUIS INDISPENSABLE : le domaine doit DÉJÀ pointer vers ce serveur
# (étape 5 de vps/README.md), sinon Let's Encrypt ne pourra pas vérifier que tu
# possèdes le domaine. Vérification faite automatiquement plus bas.
#
# Les 3 modes, expliqués :
#   --nginx      : certbot modifie LUI-MÊME la config nginx, pose les redirections
#                  HTTP→HTTPS et les lignes ssl_certificate. Le plus simple, et le
#                  seul qui « marche tout seul » la première fois.
#   --webroot    : certbot dépose un fichier dans /var/www/certbot/ et demande à
#                  nginx de le servir. Il faut donc que nginx tourne avec le bloc
#                  `location /.well-known/acme-challenge/` de nginx/site.conf.
#   --standalone : certbot monte son PROPRE serveur sur le port 80 pendant
#                  30 secondes. Interdit si nginx occupe déjà le port 80.
#
# Référence : https://certbot.eff.org/
# Renouvellement : un certificat Let's Encrypt dure 90 jours. certbot le renouvelle
# automatiquement à 30 jours de l'expiration (timer systemd certbot.timer).
set -euo pipefail

# Valeurs à personnaliser (idem que docker/.env et nginx/site.conf)
DOMAINE="{{DOMAINE}}"
DOMAINE_API="{{DOMAINE_API}}"
DOMAINE_WS="{{DOMAINE_WS}}"
EMAIL="{{EMAIL_ADMIN}}"
MODE="${1:-nginx}"

if [ "$DOMAINE" = "{{DOMAINE}}" ] || [ "$EMAIL" = "{{EMAIL_ADMIN}}" ]; then
    echo "[ERREUR] Les placeholders {{DOMAINE}} / {{EMAIL_ADMIN}} n'ont pas été remplacés dans ce script."
    echo "         Ouvre-le (nano 03-certbot-https.sh) et remplace-les avant de le lancer."
    exit 1
fi

echo "=== 1/5 Depannage prealable : le domaine pointe-t-il vers ce serveur ? ==="
# curl -sI sur le DOMAINE depuis le serveur lui-même. Trois issues :
#   - "200" ou "301"  → nginx repond, le DNS est bon : on peut certifier
#   - "Could not resolve" → le domaine ne résout PAS : DNS absent/pas propagé
#   - timeout         → le domaine pointe vers une AUTRE machine
if curl -sI --max-time 10 "http://${DOMAINE}/" -o /dev/null; then
    echo "[OK] ${DOMAINE} repond depuis ce serveur."
else
    echo "[ERREUR] Impossible d atteindre http://${DOMAINE}/ depuis ce serveur."
    echo "         Verifie le DNS (nslookup ${DOMAINE} doit donner l IP de ce serveur),"
    echo "         attends la propagation, puis relance ce script. Cf. vps/README.md etape 5."
    exit 1
fi

echo "2/5 Installation de nginx et certbot"
export DEBIAN_FRONTEND=noninteractive
apt-get update
# python3-certbot-nginx = le PLUGINS qui permet a certbot de modifier nginx tout seul
# (sans lui, certbot ne sait pas où poser les lignes ssl_* et il faudra tout faire à la main).
apt-get install -y nginx certbot python3-certbot-nginx
systemctl enable --now nginx
echo "[OK] nginx et certbot installes."

echo "3/5 Demande du certificat (mode : ${MODE})"
# Domaines couverts par le SEUL certificat : principal + API + WS.
# Un certificat « SAN » unique = un seul renouvellement, un seul dossier dans
# /etc/letsencrypt/live/ (nommé d'après le PREMIER domaine, ici ${DOMAINE}).
DOMAINES=(-d "$DOMAINE")
if [ "$DOMAINE_API" != "$DOMAINE" ]; then DOMAINES+=(-d "$DOMAINE_API"); fi
if [ "$DOMAINE_WS" != "$DOMAINE" ]; then DOMAINES+=(-d "$DOMAINE_WS"); fi

case "$MODE" in
  nginx)
    # --nginx          : certbot détecte et modifie la config nginx automatiquement
    # --non-interactive : aucune question (les domaines sont passés en argument)
    # --agree-tos      : accepter le Contrat de Services Subscribers de Let's Encrypt (obligatoire)
    # --no-eff-email   : ne pas transmettre ton e-mail à l'EFF (organisation de certbot)
    # --redirect       : ajoute lui-même la redirection HTTP → HTTPS dans la config
    certbot --nginx "${DOMAINES[@]}" \
            --email "$EMAIL" --agree-tos --no-eff-email --redirect
    ;;
  webroot)
    mkdir -p /var/www/certbot
    # -w webroot : « dépose le fichier de test dans ce dossier »
    # Le bloc location /.well-known/acme-challenge/ de nginx/site.conf sert
    # EXACTEMENT ce dossier → nginx répond, Let's Encrypt valide.
    certbot certonly --webroot -w /var/www/certbot "${DOMAINES[@]}" \
            --email "$EMAIL" --agree-tos --no-eff-email
    ;;
  standalone)
    # ⚠ Marche UNIQUEMENT si nginx n'écoute pas sur le 80 :
    #   systemctl stop nginx, lancer ce script, puis systemctl start nginx
    # Certbot relancera lui-même nginx à la fin du renouvellement.
    certbot certonly --standalone "${DOMAINES[@]}" \
            --email "$EMAIL" --agree-tos --no-eff-email
    ;;
  *)
    echo "[ERREUR] Mode inconnu : ${MODE} (attendu : nginx | webroot | standalone)"
    exit 1
    ;;
esac

echo "4/5 Verification du certificat"
certbot certificates
# Sortie attendue : Certificate Name: ${DOMAINE}, VALID: 80+ days

echo "5/5 Renouvellement automatique"
# certbot.timer = tâche planifiée qui lance `certbot renew` plusieurs fois par jour.
# certbot ne renouvelle QUE si le certificat est à moins de 30 jours de l'expiration :
# lancer ce script chaque jour ne recharge donc JAMAIS inutilement.
systemctl enable --now certbot.timer
systemctl list-timers certbot.timer --no-pager | head -3
# --dry-run = simuler un renouvellement COMPLET (y compris la mise à jour de nginx)
# sans rien modifier. C'est le test officiel : à faire maintenant, puis tous les 3 mois.
certbot renew --dry-run
echo "[OK] Renouvellement automatique verifie (dry-run sans erreur)."

# Recharge nginx au cas où certbot a modifié la config (il le fait déjà en mode
# --nginx ; ce second contrôle ne fait aucun mal et confirme la validité).
nginx -t && systemctl reload nginx

echo ""
echo "Termine"
echo "Certificat : /etc/letsencrypt/live/${DOMAINE}/ (fullchain.pem + privkey.pem)"
echo "Si nginx/site.conf n est pas encore pose ou modifie, fais-le maintenant :"
echo "  sudo cp nginx/site.conf /etc/nginx/sites-available/medisecours.conf"
echo "  sudo ln -sf /etc/nginx/sites-available/medisecours.conf /etc/nginx/sites-enabled/"
echo "  sudo rm -f /etc/nginx/sites-enabled/default"
echo "  sudo nginx -t && sudo systemctl reload nginx"
