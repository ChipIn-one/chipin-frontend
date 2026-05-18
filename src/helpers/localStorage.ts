type StorageSchema = {
    theme: 'light' | 'dark';
    locale: 'en' | 'es' | 'pt-BR' | 'pt-PT' | 'ru';
    swUpdateDismissedAt: number;
};

type StorageKey = keyof StorageSchema;

const storage = {
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
};

export { storage };
export type { StorageKey, StorageSchema };
