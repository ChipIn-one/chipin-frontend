interface ImportMetaEnv {
    /** The app origin of the site's buttons (spec 04 §4.4); see src/lib/appOrigin.ts. */
    readonly PUBLIC_APP_ORIGIN?: string;
}

// Plain TypeScript (typed ESLint, vitest) cannot resolve `.astro` imports; `astro check` types an
// existing file from the file itself. A missing `.astro` path is not reported by `astro check`
// because of this wildcard: the build and the tests catch it.
declare module '*.astro' {
    import type { AstroComponentFactory } from 'astro/runtime/server/index.js';

    const component: AstroComponentFactory;
    // eslint-disable-next-line import-x/no-default-export -- an .astro module's component is its default export
    export default component;
}
