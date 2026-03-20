# Déploiement FranClean sur VPS

## Architecture

```
Internet
   │
   ▼
franclean.castpro-tn.com (DNS → 135.125.207.107)
   │
   ▼
Nginx Host (port 80/443)
   │
   ▼ proxy_pass → localhost:8081
   │
┌──┴──────────────────────────────────────┐
│         Docker Compose Network          │
│                                         │
│  ┌─────────────┐    ┌──────────────┐    │
│  │  frontend    │───▶│   server     │    │
│  │  (nginx)     │    │  (Express)   │    │
│  │  :80 → 8081  │    │  :3000       │    │
│  └─────────────┘    └──────┬───────┘    │
│                            │            │
│                     ┌──────▼───────┐    │
│                     │  postgres    │    │
│                     │  :5432→5434  │    │
│                     └──────────────┘    │
└─────────────────────────────────────────┘
```

## Ports utilisés

| Service         | Port interne | Port externe | Notes                    |
|-----------------|-------------|-------------|--------------------------|
| PostgreSQL      | 5432        | 5434        | Évite conflit avec 5432/5433 |
| API (Express)   | 3000        | -           | Pas exposé, accès via nginx |
| Frontend (nginx)| 80          | 8081        | Reverse-proxied par l'hôte |

## Étapes de déploiement

### 1. Préparer le code sur la VPS

```bash
# Se connecter à la VPS
ssh ubuntu@135.125.207.107

# Cloner ou mettre à jour le repo
cd ~/franclean/franclean
git pull origin main
```

### 2. Configurer l'environnement de production

```bash
# Copier et éditer le fichier .env
cp .env.production .env
nano .env

# IMPORTANT: Changer ces valeurs !
# - POSTGRES_PASSWORD → un mot de passe fort
# - JWT_SECRET → générer avec: openssl rand -base64 48
```

### 3. Lancer les containers Docker

```bash
# Builder et démarrer tout
sudo docker compose up -d --build

# Vérifier que tout tourne
sudo docker compose ps

# Voir les logs
sudo docker compose logs -f
```

### 4. Configurer Nginx sur l'hôte

```bash
# Installer nginx si pas déjà fait
sudo apt update && sudo apt install -y nginx

# Copier la config
sudo cp nginx/franclean-host.conf /etc/nginx/sites-available/franclean

# Activer le site
sudo ln -s /etc/nginx/sites-available/franclean /etc/nginx/sites-enabled/

# Tester la config
sudo nginx -t

# Recharger nginx
sudo systemctl reload nginx
```

### 5. Activer HTTPS avec Certbot

```bash
# Installer certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtenir le certificat SSL
sudo certbot --nginx -d franclean.castpro-tn.com

# Le renouvellement est automatique (cron)
```

### 6. Vérification

```bash
# Tester le health check de l'API
curl http://franclean.castpro-tn.com/api/health

# Ouvrir dans le navigateur
# https://franclean.castpro-tn.com
```

## Commandes utiles

```bash
# Voir les logs d'un service
sudo docker compose logs -f server
sudo docker compose logs -f frontend
sudo docker compose logs -f postgres

# Redémarrer un service
sudo docker compose restart server

# Rebuild après changement de code
git pull origin main
sudo docker compose up -d --build

# Accéder à la base de données
sudo docker compose exec postgres psql -U franclean -d franclean_db

# Exécuter le seed
sudo docker compose exec server npx prisma db seed
```

## Résolution de problèmes

- **502 Bad Gateway** : Le backend n'est pas encore prêt. Vérifier `docker compose logs server`.
- **Frontend affiche page blanche** : Vérifier la console du navigateur + `docker compose logs frontend`.
- **Erreur de connexion DB** : Vérifier que postgres est healthy : `docker compose ps`.
