import type {
    ApiRefreshTokenPairResponse,
    ApiSelfUserResponse,
    ApiUserRole,
    ApiUserSex,
    ApiUserTheme,
} from '../../src/api/chipin.raw.types';

export interface ContractRegisterUser {
    id: string;
    email: string;
    displayName: string;
}

export interface ContractRegisterResponse {
    runId: string;
    user: ContractRegisterUser;
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const requireRecord = (value: unknown, label: string): Record<string, unknown> => {
    if (!isRecord(value)) {
        throw new Error(`${label} must be an object`);
    }

    return value;
};

const requireString = (
    record: Record<string, unknown>,
    key: string,
    label: string,
    requireNonEmpty = false,
): string => {
    const value = record[key];

    if (typeof value !== 'string' || (requireNonEmpty && value.length === 0)) {
        throw new Error(`${label}.${key} must be a ${requireNonEmpty ? 'non-empty ' : ''}string`);
    }

    return value;
};

const requireFiniteNumber = (
    record: Record<string, unknown>,
    key: string,
    label: string,
): number => {
    const value = record[key];

    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`${label}.${key} must be a finite number`);
    }

    return value;
};

const requireBoolean = (
    record: Record<string, unknown>,
    key: string,
    label: string,
): boolean => {
    const value = record[key];

    if (typeof value !== 'boolean') {
        throw new Error(`${label}.${key} must be a boolean`);
    }

    return value;
};

const requireRole = (record: Record<string, unknown>): ApiUserRole => {
    const role = record.role;

    if (role !== 'USER' && role !== 'ADMIN') {
        throw new Error('self.role must be USER or ADMIN');
    }

    return role;
};

const requireTheme = (record: Record<string, unknown>): ApiUserTheme => {
    const theme = record.theme;

    if (theme !== 'light' && theme !== 'dark' && theme !== 'system') {
        throw new Error('self.settings.theme must be light, dark, or system');
    }

    return theme;
};

const requireSex = (record: Record<string, unknown>): ApiUserSex => {
    const sex = record.sex;

    if (sex !== 'male' && sex !== 'female') {
        throw new Error('self.settings.sex must be male or female');
    }

    return sex;
};

const requireTimeFormat = (record: Record<string, unknown>): '12h' | '24h' => {
    const timeFormat = record.timeFormat;

    if (timeFormat !== '12h' && timeFormat !== '24h') {
        throw new Error('self.settings.timeFormat must be 12h or 24h');
    }

    return timeFormat;
};

const readSubscriptionUntil = (record: Record<string, unknown>): number | null => {
    const subscriptionUntil = record.subscriptionUntil;

    if (subscriptionUntil === null) {
        return null;
    }

    if (typeof subscriptionUntil !== 'number' || !Number.isFinite(subscriptionUntil)) {
        throw new Error('self.subscriptionUntil must be a finite number or null');
    }

    return subscriptionUntil;
};

const readPicture = (record: Record<string, unknown>): string | null | undefined => {
    const picture = record.picture;

    if (picture === undefined || picture === null || typeof picture === 'string') {
        return picture;
    }

    throw new Error('self.picture must be a string, null, or absent');
};

export const parseRegisterResponse = (value: unknown): ContractRegisterResponse => {
    const response = requireRecord(value, 'register');
    const user = requireRecord(response.user, 'register.user');
    const expiresIn = requireFiniteNumber(response, 'expiresIn', 'register');

    if (expiresIn <= 0) {
        throw new Error('register.expiresIn must be greater than zero');
    }

    return {
        runId: requireString(response, 'runId', 'register', true),
        user: {
            id: requireString(user, 'id', 'register.user', true),
            email: requireString(user, 'email', 'register.user', true),
            displayName: requireString(user, 'displayName', 'register.user', true),
        },
        accessToken: requireString(response, 'accessToken', 'register', true),
        refreshToken: requireString(response, 'refreshToken', 'register', true),
        expiresIn,
    };
};

export const parseSelfUserResponse = (value: unknown): ApiSelfUserResponse => {
    const response = requireRecord(value, 'self');
    const settings = requireRecord(response.settings, 'self.settings');

    return {
        id: requireString(response, 'id', 'self', true),
        email: requireString(response, 'email', 'self', true),
        displayName: requireString(response, 'displayName', 'self', true),
        picture: readPicture(response),
        role: requireRole(response),
        subscriptionUntil: readSubscriptionUntil(response),
        inviteToken: requireString(response, 'inviteToken', 'self'),
        settings: {
            defaultCurrency: requireString(settings, 'defaultCurrency', 'self.settings'),
            defaultCategory: requireString(settings, 'defaultCategory', 'self.settings'),
            timeFormat: requireTimeFormat(settings),
            language: requireString(settings, 'language', 'self.settings'),
            theme: requireTheme(settings),
            simplifyDebts: requireBoolean(settings, 'simplifyDebts', 'self.settings'),
            skipCategory: requireBoolean(settings, 'skipCategory', 'self.settings'),
            soloModeByDefault: requireBoolean(settings, 'soloModeByDefault', 'self.settings'),
            saveGroupExpensesToSolo: requireBoolean(
                settings,
                'saveGroupExpensesToSolo',
                'self.settings',
            ),
            sex: requireSex(settings),
        },
        createdAt: requireFiniteNumber(response, 'createdAt', 'self'),
        updatedAt: requireFiniteNumber(response, 'updatedAt', 'self'),
    };
};

export const parseRefreshResponse = (value: unknown): ApiRefreshTokenPairResponse => {
    const response = requireRecord(value, 'refresh');

    return {
        token: requireString(response, 'token', 'refresh', true),
        refresh_token: requireString(response, 'refresh_token', 'refresh', true),
    };
};
