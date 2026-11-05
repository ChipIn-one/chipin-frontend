// openapi-typescript options (spec 03 §4.3): the field registry turns money into `WireAmount`
// and non-money decimal maps into `Record<string, WireDecimal>`.
import ts from 'typescript';

import { isNullable, wireKind } from './wire-fields.mjs';

const { factory } = ts;

const orNull = (node, schema) =>
    isNullable(schema)
        ? factory.createUnionTypeNode([node, factory.createLiteralTypeNode(factory.createNull())])
        : node;
const reference = name => factory.createTypeReferenceNode(name);
// A nullable map value generates `Record<string, X | null>`.
const record = (value, schema) =>
    factory.createTypeReferenceNode('Record', [
        factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
        orNull(reference(value), schema.additionalProperties),
    ]);

const NODES = {
    money: () => reference('WireAmount'),
    moneyMap: schema => record('WireAmount', schema),
    decimalMap: schema => record('WireDecimal', schema),
};

/** The property name of a schema path (`#/components/schemas/X/amount` -> `amount`). */
const propertyName = path => path?.split('/').at(-1);

export const transform = (schemaObject, { path }) => {
    const kind = wireKind(propertyName(path), schemaObject);

    if (!kind) {
        return undefined;
    }

    return orNull(NODES[kind](schemaObject), schemaObject);
};

export const openapiTsOptions = {
    transform,
    inject: "import type { WireAmount, WireDecimal } from 'shared/money';\n",
};
