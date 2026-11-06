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
