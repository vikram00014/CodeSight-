# CodeSight App

Interactive execution visualizer for Python (Pyodide in browser) with timeline stepping, stack/heap views, DSA visualization, and run recap metrics.

## Local Development

Install and run:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Production Build

```bash
npm run build
npm run start
```

## Deploy to Vercel (Recommended)

If this folder is the project root in Vercel:

- Framework Preset: **Next.js**
- Install Command: `npm install`
- Build Command: `npm run build`
- Output: default Next.js

If deploying from parent monorepo repo:

- Set **Root Directory** to `codesight-app`
- Keep same install/build commands (they run inside `codesight-app`)

## Notes

- No backend server required for current Python visualization flow.
- C++ mode in UI is scaffold-only unless a separate execution backend is added.
