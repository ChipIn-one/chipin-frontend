import type { Balance } from 'entities/balance';

/** The signed-in user's app settings (`GET /users/self` → `settings`). */
export interface SelfUserSettings {
    /** ISO 4217 code. */
    readonly defaultCurrency: string;
    readonly defaultCategory: string;
    readonly timeFormat: '12h' | '24h';
    readonly language: string;
    /** An unknown theme from the server reads as `system`. */
    readonly theme: 'light' | 'dark' | 'system';
    readonly simplifyDebts: boolean;
    readonly skipCategory: boolean;
    readonly soloModeByDefault: boolean;
    readonly saveGroupExpensesToSolo: boolean;
    readonly sex: 'male' | 'female';
}

/** The signed-in user's own profile (`GET /users/self`). */
export interface SelfUser {
    readonly id: string;
    readonly email: string;
    readonly displayName: string;
    readonly picture?: string | null;
    readonly role: 'USER' | 'ADMIN';
    /** Unix seconds; null without a subscription. */
    readonly subscriptionUntil: number | null;
    readonly inviteToken: string;
    readonly settings: SelfUserSettings;
    /** Unix seconds. */
    readonly createdAt: number;
    /** Unix seconds. */
    readonly updatedAt: number;
}

/** A known user's public profile (`GET /users/known-users` → `friends[].user`). */
export interface KnownUserProfile {
    readonly id: string;
    readonly email: string;
    readonly displayName: string;
    readonly firstName?: string | null;
    readonly lastName?: string | null;
    readonly picture?: string | null;
    /** Unix seconds. */
    readonly createdAt: number;
    /** Unix seconds. */
    readonly updatedAt: number;
}

/** A known user (friend) with the direct balances between the signed-in user and them. */
export interface KnownUser {
    readonly user: KnownUserProfile;
    /**
     * The readable direct balances, one per currency: `net > 0` the friend owes you, `net < 0` you
     * owe the friend. Empty when nothing is outstanding.
     */
    readonly balances: readonly Balance[];
    /** True when a balance could not be read (left out of `balances`, reported once). */
    readonly hasUnreadableBalance: boolean;
    /** Currency of the latest direct entry with this user; null when there is none. */
    readonly lastUsedCurrency: string | null;
}
