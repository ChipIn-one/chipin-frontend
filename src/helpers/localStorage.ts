type StorageSchema = {
    theme: 'light' | 'dark';
    locale: 'en' | 'es' | 'pt-BR' | 'pt-PT' | 'ru';
    swUpdateDismissedAt: number;
};

type StorageKey = keyof StorageSchema;

const LocalStorage = {
    get<K extends StorageKey>(key: K, fallback: StorageSchema[K]): StorageSchema[K] {
        try {
            const raw = localStorage.getItem(key);
            if (raw === null) {
                return fallback;
            }
            return JSON.parse(raw) as StorageSchema[K];
        } catch {
            return fallback;
        }
    },

    set<K extends StorageKey>(key: K, value: StorageSchema[K]): void {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch {
            // ignore write errors (storage full, private mode, etc.)
        }
    },

    remove(key: StorageKey): void {
        try {
            localStorage.removeItem(key);
        } catch {
            // ignore
        }
    },

    clear(): void {
        try {
            localStorage.clear();
        } catch {
            // ignore
        }
    },

    getRaw(key: StorageKey): string | null {
        try {
            return localStorage.getItem(key);
        } catch {
            return null;
        }
    },
};

export { LocalStorage };
export type { StorageKey, StorageSchema };
