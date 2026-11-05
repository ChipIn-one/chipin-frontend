// openapi-typescript options (spec 03 §4.3): the field registry turns money into `WireAmount`
// and non-money decimal maps into `Record<string, WireDecimal>`.
import ts from 'typescript';

import { wireKind } from './wire-fields.mjs';

const { factory } = ts;

const reference = name => factory.createTypeReferenceNode(name);
const record = value =>
    factory.createTypeReferenceNode('Record', [
        factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
        reference(value),
    ]);

const isNullable = schema =>
    schema.nullable === true || (Array.isArray(schema.type) && schema.type.includes('null'));

const NODES = {
    money: () => reference('WireAmount'),
    moneyMap: () => record('WireAmount'),
    decimalMap: () => record('WireDecimal'),
};

/** The property name of a schema path (`#/components/schemas/X/amount` -> `amount`). */
const propertyName = path => path?.split('/').at(-1);

export const transform = (schemaObject, { path }) => {
    const kind = wireKind(propertyName(path), schemaObject);

    if (!kind) {
        return undefined;
    }

    const node = NODES[kind]();

    return isNullable(schemaObject)
        ? factory.createUnionTypeNode([node, factory.createLiteralTypeNode(factory.createNull())])
        : node;
};

export const openapiTsOptions = {
    transform,
    inject: "import type { WireAmount, WireDecimal } from 'shared/money';\n",
};
