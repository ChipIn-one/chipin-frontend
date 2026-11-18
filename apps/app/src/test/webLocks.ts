// Test support: an in-memory `navigator.locks` (exclusive locks only, a FIFO queue per name, the
// `signal` option). jsdom has no Web Locks; every "tab" of a test shares this one manager, as the
// tabs of one origin share the browser's.
interface LockRequestOptions {
    signal?: AbortSignal;
}

type LockCallback = (lock: { name: string; mode: 'exclusive' } | null) => unknown;

interface Waiter {
    grant: () => void;
}

const createFakeLockManager = () => {
    const held = new Set<string>();
    const queues = new Map<string, Waiter[]>();

    const release = (name: string): void => {
        const next = queues.get(name)?.shift();

        if (next) {
            next.grant();
        } else {
            held.delete(name);
        }
    };

    const request = (
        name: string,
        optionsOrCallback: LockRequestOptions | LockCallback,
        maybeCallback?: LockCallback,
    ): Promise<unknown> => {
        const options = typeof optionsOrCallback === 'function' ? {} : optionsOrCallback;
        const callback =
            typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback;

        if (!callback) {
            return Promise.reject(new TypeError('No lock callback'));
        }
        return new Promise((resolve, reject) => {
            const run = (): void => {
                let result: unknown;

                try {
                    result = callback({ name, mode: 'exclusive' });
                } catch (error: unknown) {
                    release(name);
                    reject(error);
                    return;
                }
                Promise.resolve(result).then(
                    value => {
                        release(name);
                        resolve(value);
                    },
                    (error: unknown) => {
                        release(name);
                        reject(error);
                    },
                );
            };
            const { signal } = options;

            if (signal?.aborted) {
                reject(signal.reason);
                return;
            }
            if (!held.has(name)) {
                held.add(name);
                run();
                return;
            }
            const waiter: Waiter = { grant: run };
            const queue = queues.get(name) ?? [];

            queue.push(waiter);
            queues.set(name, queue);
            signal?.addEventListener('abort', () => {
                const index = queue.indexOf(waiter);

                if (index !== -1) {
                    queue.splice(index, 1);
                    reject(signal.reason);
                }
            });
        });
    };

    return {
        request,
        query: () => Promise.resolve({ held: [], pending: [] }),
        /** Whether the lock is held now (tests only). */
        isHeld: (name: string): boolean => held.has(name),
    };
};

export type FakeLockManager = ReturnType<typeof createFakeLockManager>;

let manager: FakeLockManager | null = null;

/** Installs a new, empty lock manager as `navigator.locks` (each test starts without a held lock). */
export const installFakeWebLocks = (): FakeLockManager => {
    const next = createFakeLockManager();

    manager = next;
    Object.defineProperty(navigator, 'locks', { configurable: true, value: next });
    return next;
};

/** A browser without Web Locks (§2.3 fallback). */
export const removeWebLocks = (): void => {
    manager = null;
    Reflect.deleteProperty(navigator, 'locks');
};

/** Holds `name` until the returned release is called (another tab's write in progress). */
export const holdWebLock = (name: string): Promise<() => void> =>
    new Promise(granted => {
        void navigator.locks.request(
            name,
            () =>
                new Promise<void>(release => {
                    granted(release);
                }),
        );
    });

export const fakeWebLocks = (): FakeLockManager | null => manager;
