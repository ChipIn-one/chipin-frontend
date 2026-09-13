import { expectTypeOf, test } from 'vitest';

import type { SelfUser } from './chipin.types';

test('exposes premium entitlement fields on the authenticated user', () => {
    expectTypeOf<SelfUser>().toHaveProperty('isPremium').toEqualTypeOf<boolean>();
    expectTypeOf<SelfUser>()
        .toHaveProperty('premiumExpiresAt')
        .toEqualTypeOf<number | null>();
});
