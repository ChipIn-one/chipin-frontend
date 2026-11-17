// Test support: an in-memory `BroadcastChannel` shared by the "tabs" of a test (as the tabs of one
// origin share the browser's): a message goes to every other open channel of the same name, never
// to its sender, as a structured clone, in a microtask (no timer: fake timers do not hold it).
type Listener = (event: MessageEvent<unknown>) => void;

const createFakeBroadcastChannel = () => {
    const open = new Map<string, Set<FakeBroadcastChannel>>();

    class FakeBroadcastChannel {
        readonly name: string;
        onmessage: Listener | null = null;
        private readonly listeners = new Set<Listener>();
        private closed = false;

        constructor(name: string) {
            this.name = name;
            const channels = open.get(name) ?? new Set();

            channels.add(this);
            open.set(name, channels);
        }

        postMessage(message: unknown): void {
            if (this.closed) {
                throw new DOMException('The channel is closed', 'InvalidStateError');
            }
            const data = structuredClone(message);

            [...(open.get(this.name) ?? [])]
                .filter(channel => channel !== this)
                .forEach(channel => {
                    queueMicrotask(() => channel.deliver(data));
                });
        }

        addEventListener(type: string, listener: Listener): void {
            if (type === 'message') {
                this.listeners.add(listener);
            }
        }

        removeEventListener(type: string, listener: Listener): void {
            if (type === 'message') {
                this.listeners.delete(listener);
            }
        }

        close(): void {
            this.closed = true;
            open.get(this.name)?.delete(this);
        }

        private deliver(data: unknown): void {
            if (this.closed) {
                return;
            }
            const event = new MessageEvent('message', { data });

            this.onmessage?.(event);
            this.listeners.forEach(listener => listener(event));
        }
    }

    return {
        FakeBroadcastChannel,
        /** The open channels of `name` (tests only). */
        openCount: (name: string): number => open.get(name)?.size ?? 0,
    };
};

export type FakeBroadcastChannels = ReturnType<typeof createFakeBroadcastChannel>;

let current: FakeBroadcastChannels | null = null;

/** Installs a new, empty `BroadcastChannel` (each test starts without an open channel). */
export const installFakeBroadcastChannel = (): FakeBroadcastChannels => {
    const next = createFakeBroadcastChannel();

    current = next;
    Object.defineProperty(globalThis, 'BroadcastChannel', {
        configurable: true,
        writable: true,
        value: next.FakeBroadcastChannel,
    });
    return next;
};

export const fakeBroadcastChannels = (): FakeBroadcastChannels | null => current;
