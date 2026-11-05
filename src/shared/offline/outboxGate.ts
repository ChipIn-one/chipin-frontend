// The outbox send gate (spec 03 §2.4): in the leader's memory, `close(reason)` / `open(reason)` /
// `whenOpen()`. A no-op stub until 03-15a, which replaces the implementation at this path; callers
// (`store`/`app`) can be wired against it already.

export type OutboxGateReason = 'auth' | 'outdated' | 'blocked';

export interface OutboxGate {
    close: (reason: OutboxGateReason) => void;
    open: (reason: OutboxGateReason) => void;
    /** Resolves when no reason (except the ignored ones) keeps the gate closed. */
    whenOpen: (options?: { ignore?: OutboxGateReason[] }) => Promise<void>;
}

export const outboxGate: OutboxGate = {
    close: () => undefined,
    open: () => undefined,
    whenOpen: () => Promise.resolve(),
};
