import { expectTypeOf, test } from 'vitest';

import type { SelfUser } from './chipin.types';

test('exposes rollout-safe premium entitlement fields on the authenticated user', () => {
    expectTypeOf<SelfUser>()
        .toHaveProperty('isPremium')
        .toEqualTypeOf<boolean | undefined>();
    expectTypeOf<SelfUser>()
        .toHaveProperty('premiumExpiresAt')
        .toEqualTypeOf<number | null | undefined>();
});
