# 🧹 FranClean RH — Présentation Client

---

## Introduction

Bonjour,

Nous sommes ravis de vous présenter **FranClean RH**, l'application de gestion des ressources humaines développée sur mesure pour FranClean.

Avant de commencer la démonstration, je tiens à préciser que **toutes les fonctionnalités demandées par vous dans le cahier de charge ont été intégralement développées et livrées**. L'équipe a travaillé dessus avec sérieux pour répondre à chaque besoin exprimé.

De plus, nous avons ajouté **plusieurs fonctionnalités supplémentaires** qui ne figuraient pas dans le cahier de charge initial — c'est un **geste de notre part** et elles **ne seront pas facturées**. Nous les détaillerons au fil de la présentation.

---

## 🔐 1. Authentification & Sécurité

- Connexion sécurisée par **email + mot de passe**
- **Deux rôles distincts** : Administrateur et Agent
- Chaque rôle a son propre espace avec des fonctionnalités adaptées
- Système de **tokens JWT** avec expiration automatique
- Protection de toutes les routes : impossible d'accéder à une page sans être authentifié

---

## 👨‍💼 ESPACE ADMINISTRATEUR

---

### 📊 2. Tableau de Bord (Dashboard)

L'écran d'accueil de l'admin donne une **vue d'ensemble complète** de l'activité :

- **8 indicateurs clés** : nombre d'agents, événements en cours, pointages en attente, taux de validation, événements du mois, alertes actives, heures du mois, créneaux non assignés
- **Alertes visuelles** pour les pointages suspects et les événements nécessitant une réattribution
- **Derniers événements** et **derniers pointages** en un coup d'œil
- Accès rapide vers le Planning et le Pointage

---

### 📅 3. Planification (Planning)

C'est le **cœur de l'application** — un système complet de planification :

- **Calendrier interactif** avec vues jour / semaine / mois / liste / année / heatmap
- **Glisser-déposer** pour décaler un événement rapidement
- **Création d'événements** complète :
  - Titre, description, client (recherche parmi +80 clients prédéfinis ou création d'un nouveau)
  - Palette de **20 couleurs** pour identifier visuellement chaque événement
  - Dates début/fin, adresse avec **carte GPS interactive**
  - Rayon de géolocalisation (pour le contrôle de pointage)
  - **Prix unitaire HT par heure** (pour les récapitulatifs financiers)
- **Assignation des agents** par créneau avec :
  - Détection automatique des **conflits de planning** (un agent ne peut pas être sur deux sites en même temps)
  - Génération automatique de créneaux sur une plage de dates
  - Gestion fine par jour avec possibilité de sauter les weekends
- **Suivi des réponses agents** : accepté / en attente / refusé avec compteur visuel
- **Export PDF** du planning (jour / semaine / mois) avec en-tête FranClean, résumé et tableau détaillé
- Gestion des statuts : planifié, en cours, terminé, à réattribuer, annulé

---

### ✅ 4. Pointage (Validation)

Validation des présences des agents sur le terrain :

- **3 modes d'affichage** : liste, par agent, par événement
- **4 indicateurs** : total, en attente, suspects, validés
- **Filtres avancés** : recherche textuelle, statut, agent spécifique
- **Modal de détail** pour chaque pointage avec :
  - Photos d'arrivée et de départ (prises par l'agent)
  - **Mini-carte GPS** (OpenStreetMap) montrant la position exacte de l'agent
  - Lien Google Maps pour naviguer vers la position
  - Vérification automatique : **dans la zone** ou **hors zone**
  - Raisons de suspicion affichées clairement
- **Valider ou Refuser** un pointage (avec motif de refus obligatoire)
- Validation rapide directement depuis le tableau

---

### ⏱️ 5. Suivi des Heures

Comparaison détaillée entre **heures planifiées et heures réelles** :

- **4 indicateurs** : heures pointées, validées, facturées (90% des validées), écart
- Filtres : recherche, plage de dates
- Tableau trié avec : agent, date, mission, horaires planifiés vs réels, durée, statut
- **Détection des retards** (arrivée réelle vs planifiée)
- **Export Excel (XLSX)** complet avec GPS, raisons de suspicion, colonnes auto-dimensionnées, ligne de totaux

---

### 👥 6. Gestion des Utilisateurs

Administration complète des comptes :

- **Créer, modifier, supprimer** des utilisateurs
- Rôles : Administrateur ou Agent
- Informations : nom, prénom, email, téléphone, mot de passe
- **Activer / Désactiver** un compte sans le supprimer
- Recherche et filtrage par rôle
- Cartes visuelles avec avatar, badges de rôle, indicateur actif/inactif

---

### 📋 7. Récapitulatif (Recap) ⭐ *Fonctionnalité bonus*

**Vue financière et opérationnelle** inspirée de votre fichier Excel existant :

- **Filtre par période** avec boutons rapides (ce mois / mois dernier)
- **6 indicateurs financiers** : heures totales, heures validées, total HT, total TTC (TVA 20%), dépense salaires, marge brute

**3 onglets :**

1. **Tableau** — Feuille de temps groupée par agent
   - Colonnes : Jour, Agent, Client/Site, Heure début, Heure fin, Total heures, Heures validées
   - Sous-total par agent + total général
   - Alerte visuelle si un agent n'a pas confirmé ses créneaux
   - Double-clic sur une ligne → redirection vers le pointage pour validation

2. **Récap Agents** — Résumé par agent identique à votre Excel
   - Colonnes : Agent, Heures totales, Total du mois (heures × prix HT), Virement fait, Acompte, Reste à payer
   - **Historique des paiements** avec modal détaillé : ajouter un virement ou acompte, noter chaque paiement, voir l'historique complet, supprimer une entrée
   - Tout est **sauvegardé en base de données** (pas de localStorage)
   - Cartes KPI : Total salaires, Total heures, Taux horaire modifiable

3. **Récap Clients** — Résumé par client
   - Heures totales et validées, prix unitaire HT, total HT, total TTC
   - Cartes financières : total factures HT/TTC, dépense salaires, reste brut avec marge

---

### 🔧 8. Gestion des Affectations ⭐ *Fonctionnalité bonus*

Gestion visuelle des **assignations agent ↔ événement** :

- Filtres : recherche, événement, dates, "sans affectation"
- Cartes événement avec : statut, client, dates, adresse, bande de couleur
- Compteur de réponses agents (accepté / en attente / refusé)
- Statistiques créneaux (total, jours, non assignés)
- **Modal d'assignation** : ajouter/retirer des agents, gérer chaque créneau individuellement
- **Détection de conflits** avec possibilité de forcer l'assignation

---

## 👷 ESPACE AGENT (Mobile-friendly)

---

### 🏠 9. Tableau de Bord Agent

Page d'accueil personnalisée pour chaque agent :

- Message de bienvenue adapté à l'heure de la journée
- Bouton rapide **"Pointer mon arrivée"** si une mission est prévue aujourd'hui
- **4 indicateurs** : missions actives, heures en attente, heures validées, missions en attente de réponse
- Liste des **missions du jour** avec horaires et statut de présence
- Section **missions en attente de confirmation** (accepter / refuser)
- Résumé : nombre de pointages, total heures, taux de validation

---

### 📱 10. Mon Planning Agent

L'agent consulte ses missions et y répond :

- Missions à venir et missions passées
- Détail de chaque mission : titre, statut, créneaux horaires, adresse, client
- **Affichage intelligent des créneaux** : regroupement par pattern horaire, plages de dates, mise en évidence du jour en cours
- **Boutons Accepter / Refuser** pour chaque mission en attente
- Badge de réponse visible (accepté / refusé)

---

### 📸 11. Pointage Agent (Check-in/Check-out)

Système de pointage terrain avec **photo + GPS** :

- **3 étapes guidées** : sélection mission → photo → confirmation
- Sélecteur de mission avec indicateur de statut (entrée/sortie en attente, complet)
- **Caméra en direct** avec capture, horodatage sur la photo
- **Géolocalisation automatique** avec vérification de zone (dans/hors du rayon autorisé)
- **Détection de suspicion automatique** : hors zone, durée > 12h
- Historique des pointages du jour
- Option de reprendre la photo avant confirmation

---

### ⏰ 12. Mes Heures

Suivi personnel des heures de l'agent :

- **3 indicateurs** : heures validées, en attente, refusées
- Barre de progression mensuelle (vert=validé, ambre=en attente, rouge=refusé) avec taux de validation
- Filtres par statut : tout, validé, en attente, refusé, suspect
- Cartes détaillées par pointage : mission, date, timeline entrée/sortie, heures, statut
- Affichage des raisons de suspicion et de refus

---

## 🛠️ Fonctionnalités Transversales

| Fonctionnalité | Détail |
|---|---|
| **Notifications en temps réel** | Alertes push pour : pointages suspects, réattribution, heures supplémentaires, départ anticipé, absence de sortie, réponses agents. Panneau latéral avec marquage lu/non-lu. |
| **Temps réel (WebSocket)** | Mise à jour instantanée de toutes les données entre admin et agents — pas besoin de rafraîchir la page. |
| **Export PDF** | Planning exportable en PDF (jour/semaine/mois) avec branding FranClean. |
| **Export Excel** | Suivi des heures exportable en fichier .xlsx complet. |
| **Gestion des clients** | +80 clients prédéfinis, recherche instantanée, création à la volée, sauvegardés en base de données. |
| **Application responsive** | Interface admin optimisée desktop, interface agent optimisée mobile (PWA). |
| **Base de données PostgreSQL** | Toutes les données persistées en base — rien en localStorage. |
| **Hébergement Docker** | Déploiement via conteneurs Docker (frontend + API + PostgreSQL). |

---

## 📌 Récapitulatif : Cahier de charge vs Livré

| Élément | Cahier de charge | Livré | Bonus |
|---|:---:|:---:|:---:|
| Authentification & rôles | ✅ | ✅ | |
| Dashboard admin | ✅ | ✅ | |
| Planning calendrier | ✅ | ✅ | |
| Assignation agents | ✅ | ✅ | |
| Pointage GPS + Photo | ✅ | ✅ | |
| Validation pointage | ✅ | ✅ | |
| Suivi des heures | ✅ | ✅ | |
| Gestion utilisateurs | ✅ | ✅ | |
| Export PDF | ✅ | ✅ | |
| Interface agent mobile | ✅ | ✅ | |
| Accepter/Refuser missions | ✅ | ✅ | |
| Récapitulatif financier (Recap) | | ✅ | ⭐ Offert |
| Gestion des affectations | | ✅ | ⭐ Offert |
| Export Excel (XLSX) | | ✅ | ⭐ Offert |
| Notifications temps réel | | ✅ | ⭐ Offert |
| WebSocket (mise à jour live) | | ✅ | ⭐ Offert |
| Gestion clients (+80 prédéfinis) | | ✅ | ⭐ Offert |
| Historique paiements agents | | ✅ | ⭐ Offert |
| Détection conflits planning | | ✅ | ⭐ Offert |
| Heatmap / vue année | | ✅ | ⭐ Offert |

---

## 📅 Planning de livraison

- **Jeudi** : L'application sera **finalisée et prête** côté développement
- **Vendredi maximum** : Mise en production si l'**hébergement est prêt** de votre côté

---

## 💰 Honoraires

Nous souhaitons confirmer que nos **honoraires seront remis à Belhassen** lors de la livraison le jour convenu. Pouvons-nous compter sur cela ?

---

Merci pour votre confiance. Nous restons à votre disposition pour toute question ou ajustement.

**L'équipe de développement FranClean RH**
