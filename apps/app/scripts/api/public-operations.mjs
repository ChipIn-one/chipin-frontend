// The operations without authentication of the OpenAPI snapshot, rendered as the `PublicOperations`
// type of src/shared/api/generated/publicOperations.ts. `publicApi()` (shared/api/client.ts) accepts
// only these operations (spec 03 §5.4). Fail-closed: an operation is public only when its effective
// security (`operation.security ?? spec.security`) is an empty array; a document without a top-level
// `security` array, or a path item that is an unresolved `$ref`, throws and fails the generation.
const METHODS = ['get', 'put', 'post', 'delete', 'patch'];

const isPublic = (operation, defaultSecurity) => {
    const security = operation.security ?? defaultSecurity;

    return Array.isArray(security) && security.length === 0;
};

/** `{ [path]: methods[] }` of the public operations, paths and methods sorted; throws fail-closed. */
export const publicOperations = spec => {
    if (!Array.isArray(spec.security)) {
        throw new Error(
            'public operations: the OpenAPI document has no top-level `security` array; ' +
                'without a default every operation would read as public (fail-closed)',
        );
    }

    const result = {};

    for (const path of Object.keys(spec.paths ?? {}).sort()) {
        const item = spec.paths[path] ?? {};

        if (Object.hasOwn(item, '$ref')) {
            throw new Error(
                `public operations: path ${path} is an unresolved $ref (${item.$ref}); ` +
                    'inline the path item so its security can be checked (fail-closed)',
            );
        }

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
