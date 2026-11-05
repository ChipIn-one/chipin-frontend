// The operations without authentication (`security: []`, or no security at all) of the OpenAPI
// snapshot, rendered as the `PublicOperations` type of src/shared/api/generated/publicOperations.ts.
// `publicApi()` (shared/api/client.ts) accepts only these operations (spec 03 §5.4).
const METHODS = ['get', 'put', 'post', 'delete', 'patch'];

const isPublic = (operation, defaultSecurity) => {
    const security = operation.security ?? defaultSecurity;

    return !Array.isArray(security) || security.length === 0;
};

/** `{ [path]: methods[] }` of the public operations, paths and methods sorted. */
export const publicOperations = spec => {
    const result = {};

    for (const path of Object.keys(spec.paths ?? {}).sort()) {
        const item = spec.paths[path] ?? {};
        const methods = METHODS.filter(
            method => item[method] && isPublic(item[method], spec.security),
        );

        if (methods.length > 0) {
            result[path] = methods;
        }
    }
    return result;
};

/** The TypeScript source of `PublicOperations` (path → its public methods). */
export const renderPublicOperations = (spec, header) => {
    const rows = Object.entries(publicOperations(spec)).map(
        ([path, methods]) =>
            `    ${JSON.stringify(path)}: ${methods.map(method => `'${method}'`).join(' | ')};`,
    );

    return (
        `${header}// The operations without authentication (\`security: []\`); see publicApi().\n` +
        `export interface PublicOperations {\n${rows.join('\n')}\n}\n`
    );
};
