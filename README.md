# RGNC WebMap — Frontend

Interface WebGIS pour la consultation et la gestion du **Réseau Géodésique National du Cameroun** (RGNC). Permet de visualiser les bornes géodésiques sur une carte interactive, de télécharger les fiches signalétiques PDF et d'administrer le réseau.

---

## Table des matières

- [Aperçu](#aperçu)
- [Stack technique](#stack-technique)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Variables d'environnement](#variables-denvironnement)
- [Pages et fonctionnalités](#pages-et-fonctionnalités)
- [Structure du projet](#structure-du-projet)
- [Déploiement](#déploiement)

---

## Aperçu

| Fonctionnalité | Détail |
|----------------|--------|
| Carte interactive | OpenLayers avec clustering, basemaps OSM / Google / Satellite |
| Marqueurs | Forme = ordre (triangle/losange/cercle), couleur = statut |
| Fiches PDF | Consultation des métadonnées + téléchargement sécurisé |
| Signalements | Formulaire terrain avec photo (géomètres) |
| Dashboard admin | CRUD bornes, signalements, imports CSV, gestion des accès |
| Authentification | JWT avec rafraîchissement automatique |
| Langue | Français / Anglais |

---

## Stack technique

| Composant | Version |
|-----------|---------|
| Next.js (App Router) | 14.2 |
| React | 18.3 |
| TypeScript | 5.5 |
| OpenLayers | 9.2 |
| TanStack Query | 5.51 |
| Zustand | 4.5 |
| Tailwind CSS | 3.4 |
| Axios | 1.7 |
| React Hook Form + Zod | 7.52 / 3.23 |

---

## Prérequis

- **Node.js** 18+ (20 LTS recommandé)
- Backend Django actif (voir [RGNC_wepmap-backend](https://github.com/GislainKAM/RGNC_wepmap-backend))

---

## Installation

```bash
# 1. Installer les dépendances
npm ci

# 2. Configurer l'environnement
cp .env.local.example .env.local
# Éditer .env.local : renseigner NEXT_PUBLIC_API_URL

# 3. Démarrer le serveur de développement
npm run dev
```

L'application est disponible sur `http://localhost:3000`.

### Scripts disponibles

```bash
npm run dev        # Serveur de développement (hot reload)
npm run build      # Build de production
npm start          # Démarrer le build de production
npm run lint       # ESLint
```

---

## Variables d'environnement

Copier `.env.local.example` en `.env.local` :

```dotenv
# URL de l'API Django (sans slash final)
NEXT_PUBLIC_API_URL=http://localhost:8000/api

# Domaine du backend pour Next/Image (photos des bornes)
# Laisser vide en local. En production : hostname sans https://
# NEXT_PUBLIC_BACKEND_HOSTNAME=votre-app.up.railway.app

NEXT_PUBLIC_APP_NAME=RGNC WebMap
NEXT_PUBLIC_APP_VERSION=1.0.0
```

> Ne jamais commiter `.env.local`. Il est déjà exclu par `.gitignore`.

---

## Pages et fonctionnalités

### `/map` — Carte interactive

- Affichage de toutes les bornes géodésiques en GeoJSON
- Marqueurs SVG : forme selon l'ordre (▲ 1er / ◆ 2e / ● 3e), couleur selon le statut
- Clustering automatique avec décompte
- Panneau de filtres : statut, ordre, réseau, région, département, commune
- Barre de recherche par matricule, nom ou localité
- Fiche de détail au clic : coordonnées DD/DMS/UTM, altitude, historique, PDF
- Téléchargement de la fiche signalétique PDF (géomètres vérifiés)
- Formulaire de signalement terrain avec photo
- Choix du fond de carte (OSM, Google Maps, Satellite)
- Outil de mesure de distance (géodésique)
- Géolocalisation GPS

### `/admin` — Tableau de bord (admin uniquement)

- **Vue d'ensemble** : compteurs en temps réel, graphe de distribution par région avec tooltip interactif (détail 1er/2e/3e ordre)
- **Bornes** : tableau CRUD avec pagination, filtres et export
- **Signalements** : liste avec traitement (en attente → résolu/rejeté)
- **Import** : upload CSV/GeoJSON + aperçu avant import
- **Demandes d'accès** : validation des nouveaux comptes géomètres
- **Agents** : gestion des comptes utilisateurs et des rôles

### `/auth/login` et `/auth/register`

- Connexion par e-mail + mot de passe (JWT)
- Création de compte avec demande d'accès

### `/profil`

- Consultation et modification du profil
- Upload de photo de profil

---

## Structure du projet

```
src/
├── app/                        Pages (Next.js App Router)
│   ├── page.tsx                Redirection racine → /map ou /auth/login
│   ├── layout.tsx              Layout global (polices, metadata)
│   ├── providers.tsx           TanStack Query + Zustand
│   ├── map/page.tsx            Carte interactive
│   ├── admin/page.tsx          Dashboard admin
│   ├── auth/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   └── profil/page.tsx
│
├── components/
│   ├── map/
│   │   ├── MapCanvas.tsx       Moteur OpenLayers (~1000 lignes)
│   │   ├── PointList.tsx       Liste paginée en sidebar
│   │   ├── PointFiche.tsx      Panneau de détail
│   │   ├── FiltersPanel.tsx    Filtres géographiques et thématiques
│   │   └── SignalementModal.tsx Formulaire de signalement
│   ├── admin/
│   │   ├── AdminUI.tsx         Layout admin + graphe SVG
│   │   ├── SectionDashboard.tsx
│   │   ├── SectionBornes.tsx
│   │   ├── SectionSignalements.tsx
│   │   ├── SectionImport.tsx
│   │   ├── SectionRequests.tsx
│   │   ├── SectionAgents.tsx
│   │   └── adminUtils.ts       Helpers (formatDate, couleurs...)
│   ├── layout/
│   │   ├── Header.tsx
│   │   └── StatsStrip.tsx
│   └── ui/
│       ├── Button.tsx
│       ├── Badge.tsx
│       ├── Icon.tsx            Icônes SVG centralisées
│       ├── OrdreIcon.tsx       Indicateur d'ordre (▲ ◆ ●)
│       └── Toast.tsx
│
├── hooks/
│   ├── useAuth.ts              Zustand — login, logout, token refresh
│   ├── useGeodeticPoints.ts    TanStack Query — points, fiche, signalement
│   ├── useAdmin.ts             TanStack Query — CRUD admin, imports
│   └── useLanguage.ts          Zustand — i18n FR/EN
│
└── lib/
    ├── api.ts                  Client Axios + intercepteurs JWT
    ├── types.ts                Types TypeScript (PointGeodesiqueDetail, StatsRGNC...)
    └── constants.ts            Routes, couleurs, constantes géographiques
```

---

## Déploiement

### Vercel (démo gratuite)

1. Importer ce dépôt sur [vercel.com](https://vercel.com)
2. **Root Directory** : laisser vide (le `vercel.json` est à la racine)
3. Ajouter les variables d'environnement dans **Settings → Environment Variables**

| Variable | Valeur |
|----------|--------|
| `NEXT_PUBLIC_API_URL` | `https://votre-backend.up.railway.app/api` |
| `NEXT_PUBLIC_BACKEND_HOSTNAME` | `votre-backend.up.railway.app` |

4. Cliquer **Deploy** (~2-3 minutes)

Voir `DEPLOY_DEMO.md` (à la racine du projet) pour le guide complet Railway + Vercel.

### Docker (production)

```bash
# Build de l'image de production (~200 Mo, output standalone)
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://api.example.com/api \
  -t rgnc-webmap-frontend .

# Démarrer le conteneur
docker run -p 3000:3000 rgnc-webmap-frontend
```

### Docker (développement)

```bash
docker build -f Dockerfile.dev -t rgnc-webmap-frontend-dev .
docker run -p 3000:3000 -v $(pwd)/src:/app/src rgnc-webmap-frontend-dev
```

---

## Auteur

Gislain KAM FOTSO — [gislainkamfotso@gmail.com](mailto:gislainkamfotso@gmail.com)
