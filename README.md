# ChipIn Frontend

ChipIn web app: Vite 8, React 19, TypeScript strict, Radix Themes, i18next, PWA.
Agent and contributor rules: [`AGENTS.md`](./AGENTS.md); full rulebook: [`docs/engineering/rules/`](./docs/engineering/rules/).
Delivery: [`DEPLOYMENT.md`](./DEPLOYMENT.md).

## Installation

```bash
git clone https://github.com/ChipIn-one/chipin-frontend.git
cd chipin-frontend
npm install
```

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run test:task -- <test paths>` | Run only the listed tests; refuses to run without a path |
| `npm run test:full` | Run the complete test suite |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run the TypeScript compiler (`tsc -b`) |
| `npm run verify` | Fast check: lint with `--quiet` (only errors are shown and fail; warnings are hidden), then typecheck |
| `npm run verify:full` | Full gate, also run by CI: lint, full tests, production build, ds-gallery build |
| `npm run build` | Typecheck and production build |
| `npm run vercel-build` | Vercel deployment build: production build and public precache check, no tests |
| `npm run preview` | Preview the production build locally |
| `npm run version:check` | Check that `package.json` and `package-lock.json` versions are valid and equal |

Feature PRs do not change the version; every PR body carries `## Version impact`. Release: see `AGENTS.md`, Release.

During implementation, pass the smallest set of test files that covers the change:

```bash
npm run test:task -- src/store/groupsStore.test.ts src/pages/group-page/GroupPage.test.tsx
```

Run `npm run verify:full` before handing work over; Husky `pre-push` runs `version:check` and `verify:full`.

## License

ChipIn is proprietary and source-available, not open source. The public
repository may be viewed and used for personal, non-commercial, local,
non-production study and private experimentation. Commercial use, production
deployment, and public distribution of ChipIn proprietary code or derivative
versions are restricted without prior written permission from Mikhail Douhun.

See the full terms in [LICENSE](./LICENSE). Third-party package notices are
listed in [THIRD_PARTY_NOTICES.txt](./THIRD_PARTY_NOTICES.txt).
