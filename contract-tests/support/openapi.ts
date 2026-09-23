import { parse } from 'yaml';

export interface OpenApiResponseFieldExpectation {
    path: string;
    method: 'delete' | 'get' | 'post';
    status: string;
    fieldPaths: readonly string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const requireRecord = (value: unknown, label: string): Record<string, unknown> => {
    if (!isRecord(value)) {
        throw new Error(`${label} must be an object`);
    }
    return value;
};

const resolveLocalReference = (document: unknown, reference: string): unknown => {
    if (!reference.startsWith('#/')) {
        throw new Error(`Runtime OpenAPI reference must be local: ${reference}`);
    }
    let current: unknown = document;
    const segments = reference
        .slice(2)
        .split('/')
        .map(segment => segment.replaceAll('~1', '/').replaceAll('~0', '~'));
    for (const segment of segments) {
        const record = requireRecord(current, `Runtime OpenAPI reference ${reference}`);
        current = record[segment];
    }
    if (current === undefined) {
        throw new Error(`Runtime OpenAPI reference does not resolve: ${reference}`);
    }
    return current;
};

const collectSchemaFieldPaths = (
    document: unknown,
    schemaValue: unknown,
    fieldPaths: Set<string>,
    activeReferences: Set<string>,
    prefix = '',
): void => {
    const schema = requireRecord(schemaValue, 'Runtime OpenAPI response schema');
    const reference = schema.$ref;
    if (typeof reference === 'string' && !activeReferences.has(reference)) {
        activeReferences.add(reference);
        collectSchemaFieldPaths(
            document,
            resolveLocalReference(document, reference),
            fieldPaths,
            activeReferences,
            prefix,
        );
        activeReferences.delete(reference);
    }

    if (schema.properties !== undefined) {
        const properties = requireRecord(schema.properties, 'Runtime OpenAPI schema properties');
        for (const [field, childSchema] of Object.entries(properties)) {
            const fieldPath = prefix ? `${prefix}.${field}` : field;
            fieldPaths.add(fieldPath);
            collectSchemaFieldPaths(
                document,
                childSchema,
                fieldPaths,
                activeReferences,
                fieldPath,
            );
        }
    }

    for (const compositionKey of ['allOf', 'anyOf', 'oneOf'] as const) {
        const composition = schema[compositionKey];
        if (composition === undefined) {
            continue;
        }
        if (!Array.isArray(composition)) {
            throw new Error(`Runtime OpenAPI schema ${compositionKey} must be an array`);
        }
        for (const childSchema of composition) {
            collectSchemaFieldPaths(
                document,
                childSchema,
                fieldPaths,
                activeReferences,
                prefix,
            );
        }
    }

    if (schema.items !== undefined) {
        collectSchemaFieldPaths(
            document,
            schema.items,
            fieldPaths,
            activeReferences,
            prefix,
        );
    }
    if (isRecord(schema.additionalProperties)) {
        collectSchemaFieldPaths(
            document,
            schema.additionalProperties,
            fieldPaths,
            activeReferences,
            prefix,
        );
    }
};

const collectResponseFieldPaths = (
    document: unknown,
    responseValue: unknown,
    fieldPaths: Set<string>,
    activeReferences: Set<string>,
): void => {
    const response = requireRecord(responseValue, 'Runtime OpenAPI response');
    const reference = response.$ref;
    if (typeof reference === 'string' && !activeReferences.has(reference)) {
        activeReferences.add(reference);
        collectResponseFieldPaths(
            document,
            resolveLocalReference(document, reference),
            fieldPaths,
            activeReferences,
        );
        activeReferences.delete(reference);
    }
    if (response.content === undefined) {
        return;
    }
    const content = requireRecord(response.content, 'Runtime OpenAPI response content');
    for (const mediaTypeValue of Object.values(content)) {
        const mediaType = requireRecord(mediaTypeValue, 'Runtime OpenAPI response media type');
        if (mediaType.schema !== undefined) {
            collectSchemaFieldPaths(document, mediaType.schema, fieldPaths, new Set());
        }
    }
};

export const assertOpenApiResponseFields = (
    document: string,
    expectations: readonly OpenApiResponseFieldExpectation[],
): void => {
    const parsedDocument: unknown = parse(document);
    const root = requireRecord(parsedDocument, 'Runtime OpenAPI document');
    const paths = requireRecord(root.paths, 'Runtime OpenAPI paths');

    for (const expectation of expectations) {
        const path = requireRecord(
            paths[expectation.path],
            `Runtime OpenAPI path ${expectation.path}`,
        );
        const operation = requireRecord(
            path[expectation.method],
            `Runtime OpenAPI operation ${expectation.method.toUpperCase()} ${expectation.path}`,
        );
        const responses = requireRecord(
            operation.responses,
            `Runtime OpenAPI responses for ${expectation.method.toUpperCase()} ${expectation.path}`,
        );
        const response = requireRecord(
            responses[expectation.status],
            `Runtime OpenAPI response ${expectation.status} for ${expectation.method.toUpperCase()} ${expectation.path}`,
        );
        const responseFieldPaths = new Set<string>();
        collectResponseFieldPaths(parsedDocument, response, responseFieldPaths, new Set());

        for (const fieldPath of expectation.fieldPaths) {
            if (!responseFieldPaths.has(fieldPath)) {
                throw new Error(
                    `${expectation.method.toUpperCase()} ${expectation.path} response ${expectation.status} is missing field path ${fieldPath}`,
                );
            }
        }
    }
};
