import { parse } from 'yaml';

export interface OpenApiResponseFieldExpectation {
    path: string;
    method: 'delete' | 'get' | 'post';
    fields: readonly string[];
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

const collectSchemaFields = (
    document: unknown,
    schemaValue: unknown,
    fields: Set<string>,
    visitedReferences: Set<string>,
): void => {
    const schema = requireRecord(schemaValue, 'Runtime OpenAPI response schema');
    const reference = schema.$ref;
    if (typeof reference === 'string' && !visitedReferences.has(reference)) {
        visitedReferences.add(reference);
        collectSchemaFields(
            document,
            resolveLocalReference(document, reference),
            fields,
            visitedReferences,
        );
    }

    if (schema.properties !== undefined) {
        const properties = requireRecord(schema.properties, 'Runtime OpenAPI schema properties');
        for (const [field, childSchema] of Object.entries(properties)) {
            fields.add(field);
            collectSchemaFields(document, childSchema, fields, visitedReferences);
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
            collectSchemaFields(document, childSchema, fields, visitedReferences);
        }
    }

    if (schema.items !== undefined) {
        collectSchemaFields(document, schema.items, fields, visitedReferences);
    }
    if (isRecord(schema.additionalProperties)) {
        collectSchemaFields(document, schema.additionalProperties, fields, visitedReferences);
    }
};

const collectResponseFields = (
    document: unknown,
    responseValue: unknown,
    fields: Set<string>,
    visitedReferences: Set<string>,
): void => {
    const response = requireRecord(responseValue, 'Runtime OpenAPI response');
    const reference = response.$ref;
    if (typeof reference === 'string' && !visitedReferences.has(reference)) {
        visitedReferences.add(reference);
        collectResponseFields(
            document,
            resolveLocalReference(document, reference),
            fields,
            visitedReferences,
        );
    }

    if (response.content === undefined) {
        return;
    }

    const content = requireRecord(response.content, 'Runtime OpenAPI response content');
    for (const mediaTypeValue of Object.values(content)) {
        const mediaType = requireRecord(mediaTypeValue, 'Runtime OpenAPI response media type');
        if (mediaType.schema !== undefined) {
            collectSchemaFields(document, mediaType.schema, fields, visitedReferences);
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
        const responseFields = new Set<string>();
        const visitedReferences = new Set<string>();
        for (const response of Object.values(responses)) {
            collectResponseFields(parsedDocument, response, responseFields, visitedReferences);
        }

        for (const field of expectation.fields) {
            if (!responseFields.has(field)) {
                throw new Error(
                    `${expectation.method.toUpperCase()} ${expectation.path} response is missing field ${field}`,
                );
            }
        }
    }
};
