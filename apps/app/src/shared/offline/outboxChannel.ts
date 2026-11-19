// The outbox ping between the tabs of one user (spec 03 §2.3, D29): `BroadcastChannel(
// 'chipin-outbox:<userId>')`. A message only says "look again" or carries what is not persisted
// (a status, a settled answer); the keys stay the truth, so a lost message costs only freshness.
// Every message is validated (`OutboxChannelMessageSchema`, §5.7): another build may send it.
import { z } from 'zod';

import { OUTBOX_STATUSES } from './outboxStore';

export const outboxChannelName = (userId: string): string => `chipin-outbox:${userId}`;

/** `queued`: pending with no status of its run yet. */
export const OutboxChannelStatusSchema = z.enum([...OUTBOX_STATUSES, 'queued']);

export type OutboxChannelStatus = z.infer<typeof OutboxChannelStatusSchema>;

export const OutboxChannelMessageSchema = z.discriminatedUnion('type', [
    /** Any tab wrote the keys: re-read them (the drain tab also adopts and applies them). */
    z.object({ type: z.literal('changed') }),
    /** The drain tab: the status of one pending op. */
    z.object({ type: z.literal('status'), opId: z.string(), status: OutboxChannelStatusSchema }),
    /** A tab that just opened: the drain tab answers with one `status` per pending op. */
    z.object({ type: z.literal('status-request') }),
    /**
     * The drain tab: an op settled (`sent`, `failed` for good, or `conflicted`, §2.6); `entry` is
     * the answer (a conflict's `current`; none for a delete or a failure). Receivers run the write
     * effects (§2.2).
     */
    z.object({
        type: z.literal('settled'),
        op: z.unknown(),
        result: z.enum(['sent', 'failed', 'conflicted']),
        entry: z.unknown().optional(),
    }),
]);

export type OutboxChannelMessage = z.infer<typeof OutboxChannelMessageSchema>;

/** `BroadcastChannel` is available: without it offline writing is off (§2.3, §2.7). */
export const hasBroadcastChannel = (): boolean => typeof BroadcastChannel === 'function';

let channel: BroadcastChannel | null = null;

/** Listens on the user's channel (one per tab; a previous one is closed). No-op without it. */
export const openOutboxChannel = (
    userId: string,
    onMessage: (message: OutboxChannelMessage) => void,
): void => {
    closeOutboxChannel();
    if (!hasBroadcastChannel()) {
        return;
    }
    const opened = new BroadcastChannel(outboxChannelName(userId));

    opened.onmessage = (event: MessageEvent<unknown>) => {
        const message = OutboxChannelMessageSchema.safeParse(event.data);

        if (message.success) {
            onMessage(message.data);
        }
    };
    channel = opened;
};

/** `clearUserData` step (1), a user change, a stop: no message is received or sent any more. */
export const closeOutboxChannel = (): void => {
    channel?.close();
    channel = null;
};

/** To the other tabs of the user (a tab never receives its own message). */
export const postOutboxMessage = (message: OutboxChannelMessage): void => {
    try {
        channel?.postMessage(message);
    } catch {
        // An entry that cannot be cloned: the receivers re-read on the `changed` ping anyway.
        channel?.postMessage({ type: 'changed' } satisfies OutboxChannelMessage);
    }
};
