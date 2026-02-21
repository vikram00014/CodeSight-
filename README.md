# CodeSight Repository

This repository contains the CodeSight app in:

- `codesight-app/` → Next.js + TypeScript web app

## Quick Start (local)

```bash
npm --prefix codesight-app install
npm --prefix codesight-app run dev
```

Open `http://localhost:3000`.

## Production Build (local check)

```bash
npm --prefix codesight-app run build
```

## Deploy to Vercel

Use this repository and configure:

- **Framework Preset:** Next.js
- **Root Directory:** `codesight-app`
- **Install Command:** `npm install`
- **Build Command:** `npm run build`

After first import, every push to `main` redeploys automatically.
