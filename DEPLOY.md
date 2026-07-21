# Guide de déploiement — RatzCraft sur le PC du club (Ubuntu)

Ce guide met en place, sur la même machine Ubuntu :
1. Le **serveur Minecraft** (PaperMC 1.16.5)
2. L'**API RatzCraft** (comptes, skins, connexion) avec sa base Postgres

Tout tourne en conteneurs Docker, c'est isolé, ça redémarre tout seul si le PC reboot.

---

## 0. Ce que j'ai déjà corrigé dans le repo

Avant de déployer quoi que ce soit, sache que j'ai corrigé deux problèmes trouvés dans
`ratzcraft-server` :

- `prisma/schema.prisma` avait le modèle `User` **en double** (bug de copier-coller) →
  corrigé, un seul modèle propre.
- Une nouvelle migration a été ajoutée pour la colonne `updatedAt` qui manquait.
- **Le fichier `.env` avec un vrai secret JWT (`ismalegoat`) était commité dans Git.**
  Il faut absolument changer ce secret (ne serait-ce que parce qu'il est maintenant public
  sur GitHub) — voir étape 3.
- Un `Dockerfile` et un `docker-compose.yml` complet (Postgres + API + Minecraft) ont été
  créés, ils n'existaient pas encore.

**Applique ces changements** en remplaçant les fichiers correspondants dans ton repo
(ou en faisant un `git diff` avec ce que je te donne), puis commit :
```bash
git add -A
git commit -m "fix: schema Prisma dupliqué + Dockerfile + docker-compose complet"
```
Et pense à changer le mot de passe/secret partout où l'ancien `.env` a pu être copié.

---

## 1. Prérequis sur le PC Ubuntu

```bash
# Docker + Compose (si pas déjà fait)
sudo apt update
sudo apt install -y docker.io docker-compose-v2
sudo systemctl enable --now docker

# Autoriser ton utilisateur à lancer docker sans sudo (relogin après)
sudo usermod -aG docker $USER
```

Vérifie :
```bash
docker --version
docker compose version
```

## 2. Récupérer le projet

```bash
cd ~
git clone https://github.com/RatzLMM/ratzcraft-server.git
cd ratzcraft-server
```

## 3. Configurer les secrets

```bash
cp .env.compose.example .env
```

Édite `.env` et mets de vraies valeurs :
```
DB_PASSWORD=<mot de passe fort>
JWT_SECRET=<généré avec: openssl rand -hex 32>
```

Ce `.env` (à la racine, à côté de `docker-compose.yml`) alimente les conteneurs — il **ne
doit jamais être commité** (déjà dans `.gitignore`).

## 4. Lancer tout le stack

```bash
docker compose up -d --build
```

Ça démarre trois conteneurs :
- `ratzcraft-db` — Postgres
- `ratzcraft-api` — l'API (attend que Postgres soit prêt, applique les migrations Prisma
  automatiquement au démarrage, puis écoute sur le port 3000)
- `ratzcraft-mc` — le serveur PaperMC 1.16.5 (télécharge Paper automatiquement au premier
  lancement, ça prend quelques minutes)

Suis les logs :
```bash
docker compose logs -f
```

## 5. Vérifier que ça tourne

```bash
# API
curl http://localhost:3000/health
# -> {"api":"online","database":"online"}

# Minecraft (depuis un autre PC du réseau, remplace par l'IP locale du PC club)
# ou avec le launcher directement en pointant vers l'IP du PC
```

Test rapide de création de compte :
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@test.com","password":"azerty123"}'
```

## 6. Important — `ONLINE_MODE=FALSE`

Ton launcher utilise des comptes **offline/locaux** (UUID calculé comme un serveur
`offline-mode=true`). Le `docker-compose.yml` fourni configure donc le serveur Minecraft en
`ONLINE_MODE: "FALSE"`. **Ne change pas ça** sans adapter aussi le launcher, sinon les UUID
ne correspondront plus entre le launcher et le serveur (problèmes de skins, whitelist, etc.).

## 7. Rendre le serveur accessible depuis l'extérieur ("en ligne")

Deux cas selon le réseau du club :

### A. Le PC a une IP publique directe (rare, mais possible en datacenter/VPS)
Rien à faire côté réseau, juste ouvrir le pare-feu local :
```bash
sudo ufw allow 25565/tcp   # Minecraft
sudo ufw allow 3000/tcp    # API (ou garde-la interne, voir note plus bas)
sudo ufw enable
```

### B. Le PC est derrière une box/routeur du club (cas le plus probable)
Il faut une **redirection de port (port forwarding)** sur la box, vers l'IP locale du PC :
- Port externe `25565` (TCP) → IP locale du PC, port `25565`
- Port externe `3000` (TCP) → IP locale du PC, port `3000` (uniquement si le launcher doit
  joindre l'API depuis l'extérieur ; sinon garde-la fermée à l'extérieur pour la sécurité)

Comme l'IP publique du club change probablement (pas d'IP fixe), utilise un service de
DNS dynamique gratuit (DuckDNS, No-IP) pour avoir une adresse stable du type
`ratzcraft.duckdns.org` à donner à tes joueurs et à mettre dans la config du launcher
(`server.address`).

## 8. Persistance et redémarrages

`restart: unless-stopped` dans le compose fait que tout redémarre automatiquement si le
PC reboot ou si Docker plante, tant que Docker Desktop/daemon est lui-même lancé au boot
(`systemctl enable docker`, déjà fait à l'étape 1).

Les données persistent dans des volumes Docker nommés (`postgres_data`, `minecraft_data`),
donc `docker compose down` sans `-v` ne perd rien.

## 9. Sauvegardes (recommandé avant d'ouvrir au public)

```bash
# Backup base de données
docker exec ratzcraft-db pg_dump -U ratzcraft ratzcraft > backup_$(date +%F).sql

# Backup monde Minecraft
docker run --rm -v ratzcraft-server_minecraft_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/mc_backup_$(date +%F).tar.gz -C /data .
```
Mets ça dans un `cron` hebdomadaire si possible.

## 10. Commandes utiles

```bash
docker compose ps                 # état des services
docker compose logs -f minecraft  # logs du serveur Minecraft
docker attach ratzcraft-mc        # console Minecraft en direct (Ctrl+P puis Ctrl+Q pour sortir sans stopper)
docker compose restart api        # redémarrer juste l'API après un changement
docker compose down               # tout arrêter (garde les volumes)
```

---

## Prochaines étapes possibles

- Ajouter une route API pour uploader/servir les skins (actuellement seulement
  `auth/register`, `auth/login`, `auth/me` existent côté serveur).
- Reverse proxy (Caddy/Nginx) + HTTPS devant l'API si elle doit être appelée depuis
  internet.
- Whitelist Minecraft liée aux comptes de l'API plutôt qu'en clair.
