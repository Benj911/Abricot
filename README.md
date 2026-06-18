# 🍑 Abricot - Frontend

Abricot est une plateforme SaaS de gestion de projet intelligente destinée aux freelances et aux équipes agiles. Cette interface front-end moderne intègre un assistant IA (Mistral AI via LlamaIndex) capable de générer et d'organiser des tâches dynamiquement grâce à une architecture RAG (Retrieval-Augmented Generation).

---

## ✨ Fonctionnalités Principales

* **Tableau de Bord Centralisé** : Vue d'ensemble des tâches (mode Liste ou Kanban interactif).
* **Génération de Tâches par IA** : Analyse du contexte du projet pour suggérer des étapes de réalisation pertinentes.
* **Gestion Collaborative** : Attribution de rôles (Propriétaire / Contributeur), assignation de tâches et fil de commentaires.
* **Accessibilité (A11y)** : Interface auditée pour répondre aux normes WCAG 2.1 AA (navigation clavier, attributs ARIA, contrastes et réduction des animations).
* **Sécurité & Sessions** : Gestion de l'authentification par JWT via `js-cookie` avec middleware Next.js pour la protection des routes.

---

## 🛠 Stack Technique

Le projet repose sur un socle technique à la pointe (Écosystème 2026) :

* **Framework Core** : [Next.js 16.2](https://nextjs.org/) (App Router)
* **UI Library** : [React 19.2](https://react.dev/)
* **Langage** : [TypeScript 5](https://www.typescriptlang.org/) (Mode `Strict` activé)
* **Styling** : [Tailwind CSS v4](https://tailwindcss.com/)
* **Icônes** : [Lucide React](https://lucide.dev/)
* **Intelligence Artificielle** : LlamaIndex (`llamaindex` 0.12) & Mistral AI SDK (`@llamaindex/mistral`, `@mistralai/mistralai`)
* **Qualité de code** : ESLint 9 avec `eslint-plugin-jsx-a11y` pour garantir le respect des normes d'accessibilité.

---

## 🚀 Prérequis & Installation

### Prérequis globaux
* **Node.js** (version 20+ recommandée pour la compatibilité avec Next 16)
* **NPM** ou **Yarn**
* Un backend Abricot fonctionnel (tournant sur le port `8000` par défaut).

### 1. Cloner et installer les dépendances

```bash
git clone <url-du-repo>
cd abricot-frontend
npm install
```

### 2. Configuration des variables d'environnement

Créer un fichier `.env.local` à la racine du projet pour configurer l'accès à l'IA et au backend :

```env
# Clé API pour le modèle Mistral AI
MISTRAL_API_KEY=votre_cle_api_mistral_ici

# URL du backend Express (Le proxy Next.js redirigera /api vers cette URL)
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 3. Lancer l'environnement de développement

```bash
npm run dev
```

L'application est désormais accessible sur [http://localhost:3000](http://localhost:3000).  
*Note : Un Reverse Proxy est configuré dans `next.config.ts` pour rediriger silencieusement les appels `/api/*` vers `localhost:8000`, contournant ainsi les problématiques CORS en développement.*

---

## 📜 Scripts Disponibles

* `npm run dev` : Lance le serveur de développement avec Fast Refresh (Turbopack).
* `npm run build` : Compile l'application pour la production.
* `npm run start` : Démarre le serveur de production (nécessite un build préalable).
* `npm run lint` : Exécute ESLint pour vérifier la qualité du code et l'accessibilité JSX.

---

## 📁 Architecture du projet (App Router)

L'arborescence suit les recommandations strictes de Next.js avec le système de routage basé sur les dossiers (`src/app`) :

```text
src/
├── app/
│   ├── (auth)/             # Groupe de routes publiques (login, register)
│   ├── (dashboard)/        # Groupe de routes privées nécessitant une session
│   │   ├── dashboard/      # Tableau de bord principal
│   │   ├── profile/        # Gestion du compte utilisateur
│   │   └── projects/       # Liste des projets et vues détaillées ([id])
│   ├── local-api/          # Routes API Server-Side (Génération IA avec LlamaIndex)
│   ├── globals.css         # Styles globaux, variables métier et directives WCAG
│   ├── layout.tsx          # Root Layout (Polices Inter/Manrope, Métadonnées)
│   └── not-found.tsx       # Page d'erreur 404 personnalisée
└── middleware.ts           # Gatekeeping : Redirection auto basée sur la validité du token
```

---

## ⚙️ Configuration TypeScript (`tsconfig.json`)

Le projet est configuré pour un niveau de rigueur maximal :
* `"strict": true` : Prévient les erreurs silencieuses et impose un typage fort.
* `"moduleResolution": "bundler"` : Optimisé pour le build de Next.js.
* Les alias de chemin (`@/*`) sont configurés pour des imports relatifs propres depuis la racine `src/`.