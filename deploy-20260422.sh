#!/bin/bash
# ============================================================
# Script de déploiement – Mise à jour du 22/04/2026
# ============================================================
# Nouvelles migrations à appliquer :
#   1. 20260422101021_add_agent_percentage
#      → ALTER TABLE "users" ADD COLUMN "agentPercentage" DOUBLE PRECISION;
#
#   2. 20260422102153_add_break_hours
#      → ALTER TABLE "events" ADD COLUMN "breakHours" DOUBLE PRECISION NOT NULL DEFAULT 0;
#
#   3. 20260422133123_add_client_sub_accounts
#      → DROP INDEX "users_clientId_key";
#      → ALTER TABLE "users" ADD COLUMN "isMainAccount" BOOLEAN NOT NULL DEFAULT false;
#      → CREATE TABLE "client_user_sites" (id, userId, clientSiteId)
#      → + index unique + foreign keys
#
# Nouvelles fonctionnalités :
#   - Pourcentage agent (agentPercentage) sur les utilisateurs
#   - Heures de pause (breakHours) sur les événements
#   - Système de sous-comptes client (isMainAccount, client_user_sites)
#   - Vue détail sites côté client portal
#   - Blocage GPS au pointage agent
#   - Refonte visuelle portail client (suppression Portail Sécurisé, Suivi transparent, Accès rapide)
# ============================================================

set -e

echo "🚀 Déploiement FranClean – 22/04/2026"
echo "======================================="

# 1. Se positionner dans le dossier du projet
cd ~/franclean/franclean

# 2. Pull le dernier code
echo ""
echo "📥 Pull du code depuis main..."
git pull origin main

# 3. Rebuild et redémarrage des containers
# (Le Dockerfile du server exécute automatiquement:
#   npx prisma generate  → au build
#   npx prisma migrate deploy  → au démarrage du container)
echo ""
echo "🔨 Rebuild des containers Docker..."
sudo docker compose up -d --build

# 4. Attendre que le serveur soit prêt
echo ""
echo "⏳ Attente du démarrage des services..."
sleep 10

# 5. Vérifier que les migrations ont bien été appliquées
echo ""
echo "✅ Vérification des migrations..."
sudo docker compose exec server npx prisma migrate status

# 6. Mettre à jour les comptes clients existants
# Les comptes client existants doivent être marqués comme compte principal
echo ""
echo "🔧 Mise à jour des comptes clients existants (isMainAccount = true)..."
sudo docker compose exec postgres psql -U franclean -d franclean_db -c "
UPDATE users SET \"isMainAccount\" = true WHERE role = 'client' AND \"isMainAccount\" = false;
"

# 7. Vérifier le health check
echo ""
echo "🏥 Health check de l'API..."
curl -s http://localhost:8081/api/health || echo "⚠️  Health check non disponible"

echo ""
echo "======================================="
echo "✅ Déploiement terminé !"
echo ""
echo "Résumé des changements DB :"
echo "  - users.agentPercentage (DOUBLE PRECISION, nullable)"
echo "  - events.breakHours (DOUBLE PRECISION, default 0)"
echo "  - users.isMainAccount (BOOLEAN, default false)"
echo "  - users.clientId n'est plus UNIQUE (suppression de l'index)"
echo "  - Nouvelle table client_user_sites (userId + clientSiteId)"
echo ""
echo "⚠️  IMPORTANT : Tous les comptes clients existants ont été"
echo "   marqués isMainAccount=true (compte principal)."
echo "   Les sous-comptes se créent depuis le portail client > Équipe."
