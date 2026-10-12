# Checklist de recette — mise en ligne MediSecours+

> À exécuter **intégralement** après chaque déploiement, avant d'annoncer que
> « c'est en ligne ». Chaque point a un résultat attendu unique ; si un point
> échoue, on ne passe pas au suivant : on corrige puis on **reprend au point
> échoué**.
>
> Remplacer `APP=https://medisecours.batirlepays.com`,
> `API=https://api.medisecours.batirlepays.com`,
> `WS=https://ws.medisecours.batirlepays.com`.
> (Variante mono-domaine : `API=$APP/api`, `WS=$APP`.)

## A. Infrastructure

**1. Tous les conteneurs sont stables**
```bash
docker compose -f docker-compose.prod.yml ps   # ou Coolify → Resources
```
Attendu : chaque service `Up (healthy)` (ou `running` pour ws), **aucun**
`Restarting`, état stable sur ~2 minutes (pas de reboot en boucle).

**2. HTTPS valide sur les 3 domaines**
```bash
curl -sI https://medisecours.batirlepays.com | head -1
curl -sI https://api.medisecours.batirlepays.com | head -1
curl -sI https://ws.medisecours.batirlepays.com | head -1
```
Attendu : `HTTP/2 200` (ou 30x) partout, certificat non expiré (padlock sans
avertissement). Une erreur `ERR_CERT_*` = certbot/Coolify à revoir
(`../fullstack/vps/03-certbot-https.sh`).

## B. Santé des services

**3. Santé API via le front (rewrite `/api`)**
```bash
curl -s $APP/api/health
```
Attendu : réponse JSON de santé (200). Si 404 → `API_BASE_URL` absente/fausse
au **build** du front (rebuild obligatoire). Si 500 → base injoignable,
voir point 5.

**4. Santé API directe + WS**
```bash
curl -s $API/api/health   # 200
curl -s $WS/health        # 200
```
Attendu : 200 sur les deux. `ws/health` en 502/timeout → le service Node n'a
pas démarré (logs : `docker logs medisecours-ws`).

**5. Base de données joignable et migrée**
```bash
docker compose -f docker-compose.prod.yml exec db \
  psql -U medisecours -d medisecours -c "\dt" | head
```
Attendu : les tables métier là (pas d'erreur de connexion). Si migrations en
cours au premier boot, attendre la fin **avant** de juger le `/api/health`.

## C. Sécurité

**6. La base n'est pas exposée publiquement**
```bash
curl -s --max-time 5 http://IP_SERVEUR:5432 && echo EXPOSEE || echo OK
```
Attendu : `OK` (timeout/refus). Une réponse = port 5432 ouvert → le fermer
pare-feu immédiatement.

**7. CORS strict**
```bash
curl -sI -H "Origin: https://evil.example" $API/api/health | grep -i access-control
curl -sI -H "Origin: https://medisecours.batirlepays.com" $API/api/health | grep -i access-control
```
Attendu : **aucun** en-tête `Access-Control-Allow-Origin` pour `evil.example`,
en-tête présent pour l'origine légitime. `*` = régression de sécurité
(`CORS_ALLOW_ORIGIN` mal regexé).

**8. Aucun secret versionné**
```bash
git log -p --all | grep -iE "password=|BEGIN (RSA )?PRIVATE KEY" | head
```
Attendu : rien (ou uniquement des exemples `<…>`). Un vrai secret trouvé →
le changer partout **et** purger l'historique.

**9. Admin créé puis variables retirées**
Dans l'UI de déploiement : `CREATE_ADMIN_EMAIL` / `CREATE_ADMIN_PASSWORD`
**absentes**. Attendu : connectable avec le compte créé une seule fois (si
encore présentes, un nouvel admin se recrée à chaque redéploiement).

## D. Fonctionnel (parcours utilisateur réel)

**10. Page d'accueil en cache froid**
`Ctrl+Maj+R` puis navigation privée sur `$APP`.
Attendu : rendu complet, pas d'écran blanc (piège `.next/standalone`),
polices/couleurs normales.

**11. Inscription / connexion**
Créer un compte puis se connecter.
Attendu : succès, jeton posé, pas d'erreur CORS dans la console.

**12. Action critique qui touche l'API + la base**
Publier ou modifier un élément (ex. contribution établissement), recharger
la page.
Attendu : les données persistent (preuve base + write OK).

**13. Temps réel (WebSockets)**
Ouvrir deux navigateurs sur la même page ; déclencher une mise à jour côté 1.
Attendu : la 2e voit le changement **sans recharger**.
Échec silencieux → `NEXT_PUBLIC_WS_URL` absente au build ou
`WS_PUBLISH_SECRET` différent entre backend et ws (logs :
`X-WS-Publish-Secret` refusé).

**14. Upload de fichier**
Téléverser une image (fiche établissement).
Attendu : fichier stocké et ré-affiché après rechargement (volume
`medisecours_uploads` monté — sinon perdu au redéploiement).

**15. Carte Santé**
Ouvrir `$APP/carte`, charger un lieu, changer de provider si configuré.
Attendu : au moins un provider fonctionne (Forge/Google → Mapbox → Leaflet).
Carte blanche + erreur console de clé → clé refusée au build → rebuilder.

## E. Multilingue / finitions

**16. Bascule de langue**
Passer `FR → EN → FR` sur au moins 3 pages (accueil, fiche, admin).
Attendu : traductions complètes (les `*.json` ont parité de clés), aucun
texte brut type « Aucune donnée » non traduit.

**17. Journalisation et surveillance**
```bash
docker compose -f docker-compose.prod.yml logs --since=10m backend | grep -iE "error|critical" | head
```
Attendu : pas d'erreur critique ; un mécanisme de veille signale l'arrêt
(repo : `.github/workflows/keepalive.yml` ou uptime externe cf. `../aws/budget.md`).

---

## Sign-off

| Étape | Nom | Date | OK / KO (point n°) |
|---|---|---|---|
| 1-5 Infra & santé | | | |
| 6-9 Sécurité | | | |
| 10-15 Fonctionnel | | | |
| 16-17 Finitions | | | |

**17/17 OK = mise en ligne validée.** Un KO → corriger, redéployer,
**reprendre au point échoué** (pas besoin de refaire les points déjà validés
sauf les points 1-2 qui sont à rejouer après tout redéploiement).
