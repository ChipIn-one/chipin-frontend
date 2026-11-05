// The wire field registry (spec 03 §4.3): which numeric fields of the OpenAPI snapshot are money.
// `multipleOf: 0.0001` alone does not decide it, the backend sets it on percentages and weights too.
// The lists are written to `src/shared/api/generated/wireFields.ts` for the transport (03-4b).
//
// Checked against openapi/chipin.yaml by gen-types.mjs (exit 1 on any error):
// (a) every `multipleOf: 0.0001` number (or map of them) is a property in exactly one list;
// (b) a MONEY_FIELDS property, in any schema, is a number with `multipleOf: 0.0001`, and a
//     MONEY_MAP_FIELDS property is a map of such numbers;
// (c) the generated `percentageShares` is `Record<string, WireDecimal>`;
// plus: every listed field still exists in the snapshot (a stale entry is an error).

/** Amounts: `WireAmount`. */
export const MONEY_FIELDS = ['amount', 'netAmount', 'netBalance', 'shareAmount'];
/** Amounts by key (`userId`): `Record<string, WireAmount>`. */
export const MONEY_MAP_FIELDS = ['customShares'];
/** Non-money decimals by key (percentages, weights, rates): `Record<string, WireDecimal>`. */
export const DECIMAL_MAP_FIELDS = ['percentageShares', 'rates', 'shares'];

export const LEDGER_STEP = 0.0001;

const isNumber = schema =>
    schema?.type === 'number' || (Array.isArray(schema?.type) && schema.type.includes('number'));
const isNumberMap = schema =>
    typeof schema?.additionalProperties === 'object' && isNumber(schema.additionalProperties);
const isScaled = schema => schema?.multipleOf === LEDGER_STEP;

/** `'money' | 'moneyMap' | 'decimalMap'` for a registered property of the expected shape, else undefined. */
export const wireKind = (name, schema) => {
    if (MONEY_FIELDS.includes(name) && isNumber(schema)) {
        return 'money';
    }
    if (MONEY_MAP_FIELDS.includes(name) && isNumberMap(schema)) {
        return 'moneyMap';
    }
    if (DECIMAL_MAP_FIELDS.includes(name) && isNumberMap(schema)) {
        return 'decimalMap';
    }
    return undefined;
};

const pointer = segments =>
    `#/${segments.map(s => String(s).replace(/~/g, '~0').replace(/\//g, '~1')).join('/')}`;

/** Every `multipleOf: 0.0001` schema and every object property of the document, with JSON pointers. */
const scan = document => {
    const scaled = [];
    const properties = [];
    const walk = (node, segments) => {
        if (node === null || typeof node !== 'object') {
            return;
        }
        if (isScaled(node)) {
            scaled.push(pointer(segments));
        }
        if (!Array.isArray(node) && node.properties && typeof node.properties === 'object') {
            for (const [name, schema] of Object.entries(node.properties)) {
                properties.push({ name, schema, path: pointer([...segments, 'properties', name]) });
            }
        }
        for (const [key, value] of Object.entries(node)) {
            walk(value, [...segments, key]);
        }
    };

    walk(document, []);
    return { scaled, properties };
};

/** Checks (a), (b) and the stale-entry check; returns the error messages (empty = ok). */
export const checkWireFields = document => {
    const errors = [];
    const lists = [...MONEY_FIELDS, ...MONEY_MAP_FIELDS, ...DECIMAL_MAP_FIELDS];
    const classified = new Set();
    const used = new Set();

    for (const name of new Set(lists)) {
        if (lists.indexOf(name) !== lists.lastIndexOf(name)) {
            errors.push(`${name} is in more than one list of scripts/api/wire-fields.mjs`);
        }
    }

    const { scaled, properties } = scan(document);

    for (const { name, schema, path } of properties) {
        const kind = wireKind(name, schema);

        if (kind) {
            used.add(name);
            classified.add(kind === 'money' ? path : `${path}/additionalProperties`);
        }
        if (MONEY_FIELDS.includes(name) && !(kind === 'money' && isScaled(schema))) {
            errors.push(
                `(b) ${path}: a MONEY_FIELDS property must be a number with multipleOf: ${LEDGER_STEP}`,
            );
        }
        if (
            MONEY_MAP_FIELDS.includes(name) &&
            !(kind === 'moneyMap' && isScaled(schema.additionalProperties))
        ) {
            errors.push(
                `(b) ${path}: a MONEY_MAP_FIELDS property must be a map of multipleOf: ${LEDGER_STEP} numbers`,
            );
        }
    }
    for (const path of scaled) {
        if (!classified.has(path)) {
            errors.push(
                `(a) ${path}: multipleOf: ${LEDGER_STEP} is not classified; add the field to exactly one list in scripts/api/wire-fields.mjs`,
            );
        }
    }
    for (const name of lists) {
        if (!used.has(name)) {
            errors.push(
                `${name} (scripts/api/wire-fields.mjs) matches no property of the snapshot: remove it`,
            );
        }
    }
    return errors;
};

/** Check (c) on the generated `schema.d.ts` text. */
export const checkGeneratedTypes = text => {
    const types = [...text.matchAll(/\bpercentageShares\??: ([^;]+);/g)].map(match => match[1]);

    if (types.length === 0 || types.some(type => type !== 'Record<string, WireDecimal>')) {
        return [
            `(c) percentageShares must be Record<string, WireDecimal>, got: ${types.join(' | ') || 'none'}`,
        ];
    }
    return [];
};

/** The text of `src/shared/api/generated/wireFields.ts`. */
export const renderWireFields = () => {
    const list = (name, fields) =>
        `export const ${name} = [${fields.map(f => `'${f}'`).join(', ')}] as const;\n`;

    return (
        '// Generated by scripts/api/gen-types.mjs from scripts/api/wire-fields.mjs. Do not edit.\n\n' +
        list('MONEY_FIELDS', MONEY_FIELDS) +
        list('MONEY_MAP_FIELDS', MONEY_MAP_FIELDS) +
        list('DECIMAL_MAP_FIELDS', DECIMAL_MAP_FIELDS)
    );
};
