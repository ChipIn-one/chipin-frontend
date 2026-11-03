import { appGlob } from './base.js';

// Layer boundaries expressed as `no-restricted-imports` entries (see project.js for the entry
// shape). The boundaries plugin and the layer graph (spec 02 §D5) land here in 02-C9.

const RUNTIME_API_MODULE =
    '^(?:api/|(?:\\.\\.?/)+(?:[^/]+/)*api/)(?!.*\\.types(?:\\.[cm]?[jt]sx?)?$)';

/** `no-restricted-imports` entries for the layer boundaries. */
export const layerImports = ({ appDir }) => {
    // These modules own the configured Axios instance and interceptors.
    const axiosOwners = appGlob(appDir, 'src/api/chipin.{instance,interceptors}.ts');
    const ui = appGlob(appDir, 'src/{pages,features,components,basics}/**/*.{ts,tsx}');
    const numbers = appGlob(appDir, 'src/{helpers/numbers.ts,basics/numbers/**/*.{ts,tsx}}');

    return [
        {
            id: 'axios',
            path: 'axios',
            ignores: [axiosOwners, ui, numbers],
            message: 'Use the configured Axios instance from src/api.',
        },
        {
            id: 'axios-in-ui',
            path: 'axios',
            files: [ui],
            ignores: [numbers],
            message: 'UI must call stores or hooks, not Axios.',
        },
        {
            id: 'axios-in-numbers',
            path: 'axios',
            files: [numbers],
            message: 'The number layer cannot call Axios.',
        },
        {
            id: 'runtime-api-in-ui',
            pattern: { regex: RUNTIME_API_MODULE, allowTypeImports: true },
            files: [ui],
            ignores: [numbers],
            message: 'UI must call a store action instead of a runtime API module.',
        },
        {
            id: 'runtime-api-in-numbers',
            pattern: { regex: RUNTIME_API_MODULE, allowTypeImports: true },
            files: [numbers],
            message: 'The number layer cannot call runtime API modules.',
        },
    ];
};
