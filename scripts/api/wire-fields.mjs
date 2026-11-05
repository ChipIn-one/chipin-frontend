// The wire field registry (spec 03 §4.3): which numeric fields of the OpenAPI snapshot are money.
// `multipleOf: 0.0001` alone does not decide it, the backend sets it on percentages and weights too.
// The lists are written to `src/shared/api/generated/wireFields.ts` for the transport (03-4b).
//
// Checked against openapi/chipin.yaml by gen-types.mjs (exit 1 on any error):
// (a) every `multipleOf: 0.0001` schema is a registered property (or its map values), and every
//     non-integer number property (or map/array of numbers) is in exactly one list or in
//     NON_MONEY_NUMBER_FIELDS; a number must be plain `number` (or `number | null`), no other union;
// (b) a MONEY_FIELDS property, in any schema, is a number with `multipleOf: 0.0001`, and a
//     MONEY_MAP_FIELDS property is a map of such numbers;
// (c) the generated `percentageShares` is `Record<string, WireDecimal>`, and no registered field
//     is generated with `number`;
// plus: every listed field still exists in the snapshot (a stale entry is an error).

/** Amounts: `WireAmount`. */
export const MONEY_FIELDS = ['amount', 'netAmount', 'netBalance', 'shareAmount'];
/** Amounts by key (`userId`): `Record<string, WireAmount>`. */
export const MONEY_MAP_FIELDS = ['customShares'];
/** Non-money decimals by key (percentages, weights, rates): `Record<string, WireDecimal>`. */
export const DECIMAL_MAP_FIELDS = ['percentageShares', 'rates', 'shares'];
/** Non-integer numbers that are knowingly not money and stay `number` (empty today). */
export const NON_MONEY_NUMBER_FIELDS = [];

export const REGISTRY = {
    money: MONEY_FIELDS,
    moneyMap: MONEY_MAP_FIELDS,
    decimalMap: DECIMAL_MAP_FIELDS,
    nonMoney: NON_MONEY_NUMBER_FIELDS,
};

export const LEDGER_STEP = 0.0001;

const types = schema => (Array.isArray(schema?.type) ? schema.type : [schema?.type]);
/** Any schema whose type mentions `number`. */
const mentionsNumber = schema => types(schema).includes('number');
/** Exactly `number` or `number | null`. */
const isNumber = schema =>
    mentionsNumber(schema) && types(schema).every(type => type === 'number' || type === 'null');
const isNumberMap = schema =>
    typeof schema?.additionalProperties === 'object' && isNumber(schema.additionalProperties);
const isScaled = schema => schema?.multipleOf === LEDGER_STEP;

export const isNullable = schema => schema?.nullable === true || types(schema).includes('null');

/** `'money' | 'moneyMap' | 'decimalMap'` for a registered property of the expected shape, else undefined. */
export const wireKind = (name, schema, registry = REGISTRY) => {
    if (registry.money.includes(name) && isNumber(schema)) {
        return 'money';
    }
    if (registry.moneyMap.includes(name) && isNumberMap(schema)) {
        return 'moneyMap';
    }
    if (registry.decimalMap.includes(name) && isNumberMap(schema)) {
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

const holdsNumbers = schema =>
    mentionsNumber(schema) ||
    mentionsNumber(schema?.additionalProperties) ||
    mentionsNumber(schema?.items);

/** Checks (a), (b) and the stale-entry check; returns the error messages (empty = ok). */
export const checkWireFields = (document, registry = REGISTRY) => {
    const errors = [];
    const lists = Object.values(registry).flat();
    const classified = new Set();
    const used = new Set();

    for (const name of new Set(lists)) {
        if (lists.indexOf(name) !== lists.lastIndexOf(name)) {
            errors.push(`${name} is in more than one list of scripts/api/wire-fields.mjs`);
        }
    }

    const { scaled, properties } = scan(document);

    for (const { name, schema, path } of properties) {
        const kind = wireKind(name, schema, registry);
        const allowed = registry.nonMoney.includes(name) && isNumber(schema);

        if (kind || allowed) {
            used.add(name);
        }
        if (kind) {
            classified.add(kind === 'money' ? path : `${path}/additionalProperties`);
        } else if (!allowed && holdsNumbers(schema)) {
            errors.push(
                `(a) ${path}: an unclassified number field (or a number union); add it to exactly one list in scripts/api/wire-fields.mjs`,
            );
        }
        if (registry.money.includes(name) && !(kind === 'money' && isScaled(schema))) {
            errors.push(
                `(b) ${path}: a MONEY_FIELDS property must be a number with multipleOf: ${LEDGER_STEP}`,
            );
        }
        if (
            registry.moneyMap.includes(name) &&
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
    for (const name of new Set(lists)) {
        if (!used.has(name)) {
            errors.push(
                `${name} (scripts/api/wire-fields.mjs) matches no property of the snapshot: remove it`,
            );
        }
    }
    return errors;
};

/** Check (c) on the generated `schema.d.ts` text. */
export const checkGeneratedTypes = (text, registry = REGISTRY) => {
    const errors = [];
    const generated = name =>
        [...text.matchAll(new RegExp(`\\b${name}\\??: ([^;]+);`, 'g'))].map(match => match[1]);
    const percentage = generated('percentageShares');

    if (
        percentage.length === 0 ||
        percentage.some(type => type !== 'Record<string, WireDecimal>')
    ) {
        errors.push(
            `(c) percentageShares must be Record<string, WireDecimal>, got: ${percentage.join(' | ') || 'none'}`,
        );
    }
    for (const name of [...registry.money, ...registry.moneyMap, ...registry.decimalMap]) {
        for (const type of generated(name).filter(type => /\bnumber\b/.test(type))) {
            errors.push(
                `(c) ${name} is generated as "${type}": the registry transform did not apply`,
            );
        }
    }
    return errors;
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
