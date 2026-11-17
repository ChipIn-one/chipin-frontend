// Compile-time guard for the generated API types (spec 03 §4.3). `schema.d.ts` is skipped by
// `skipLibCheck`, so if its injected `shared/money` import stopped resolving, every money field
// would silently become `any`; this file is a regular .ts that `tsc -b` checks.
import type { WireAmount, WireDecimal } from 'shared/money';

import type { components } from './generated/schema';

type Schemas = components['schemas'];
type IsAny<T> = 0 extends 1 & T ? true : false;
type Equals<A, B> =
    (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
/**
 * `T` is exactly `Expected`: not `any`, not assignable to `number`, and accepting neither `number`
 * nor `string`. Every check type is wrapped in a tuple: the error type of an unresolved import
 * would otherwise turn a bare conditional into `any`, which satisfies `Assert`.
 */
type Exactly<T, Expected> = [IsAny<T>] extends [true]
    ? false
    : [T] extends [number]
      ? false
      : [number] extends [T]
        ? false
        : [string] extends [T]
          ? false
          : Equals<T, Expected>;
type Assert<T extends true> = T;

type SharingMode = Schemas['SharingMode'];
type MemberField<K extends string> = Extract<SharingMode, Record<K, unknown>>[K];
type MapValue<T> = T extends Record<string, infer V> ? V : never;

export type GeneratedTypesChecks = [
    Assert<Exactly<Schemas['LedgerExpenseInfo']['amount'], WireAmount>>,
    Assert<Exactly<MemberField<'customShares'>, Record<string, WireAmount>>>,
    Assert<Exactly<MapValue<MemberField<'customShares'>>, WireAmount>>,
    Assert<Exactly<MemberField<'percentageShares'>, Record<string, WireDecimal>>>,
    Assert<Exactly<Schemas['CurrencyRatesResponse']['rates'], Record<string, WireDecimal>>>,
];
