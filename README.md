# ChipIn Frontend

A React 19 + Vite frontend project that provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## 🚀 Features

-   ⚡️ **Vite** - Next generation frontend tooling
-   ⚛️ **React 19** - Latest React version
-   🔥 **Hot Module Replacement (HMR)** - Fast development experience
-   📝 **ESLint** - Code quality and consistency
-   🏗️ **TypeScript ready** - Type checking support

## 🛠️ Tech Stack

Currently, two official plugins are available:

-   [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
-   [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## 📦 Installation

```bash
git clone https://github.com/your-username/chipin-frontend.git
cd chipin-frontend
npm install
```

## 🚀 Available Commands

| Command                                      | Description                                      |
| -------------------------------------------- | ------------------------------------------------ |
| `npm run dev`                                | Start the development server                     |
| `npm run test:task -- <test paths>`          | Run only explicitly selected tests               |
| `npm run test:full`                          | Run the complete test suite                      |
| `npm run typecheck`                          | Run the TypeScript compiler                      |
| `npm run verify`                             | Fast lint/typecheck verification                 |
| `npm run verify:full`                        | Full completion gate: lint, tests, and production build |
| `npm run vercel-build`                       | Vercel gate: full test suite followed by production build |
| `npm run build`                              | Generate version and build for production        |
| `npm run preview`                            | Preview the production build locally             |
| `npm run lint`                               | Run ESLint to check code quality                 |

## 🛠️ Development

### Start Development Server

```bash
npm run dev
```

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

### Run Linter

```bash
npm run lint
```

### Run Targeted Tests

During implementation, pass the smallest set of test files that covers the changed behavior:

```bash
npm run test:task -- src/store/groupsStore.test.ts src/pages/group-page/GroupPage.test.tsx
```

`test:task` refuses to run without an explicit test path, which prevents an accidental full-suite run.

### Full Completion Verification

Run the full completion gate at implementation completion and CI/release checkpoints:

```bash
npm run verify:full
```

## 📝 License

This project is licensed under the License. chipin-frontend
