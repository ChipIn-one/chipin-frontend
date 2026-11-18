// Test support: the page lifecycle of one outbox "tab" (`setOutboxPage`): the tabs of a test share
// one jsdom `document`, so each gets its own visibility and its own hidden/visible/freeze events.
import type { OutboxPage } from 'shared/offline/outboxDrain';

type Handlers = Parameters<OutboxPage['listen']>[0];

export interface FakeOutboxPage {
    page: OutboxPage;
    hide: () => void;
    show: () => void;
    /** `freeze`/`pagehide`: the page is hidden and frozen. */
    freeze: () => void;
    /** Listeners currently added (0 once the drain stopped). */
    listenerCount: () => number;
}

export const fakeOutboxPage = (hidden = false): FakeOutboxPage => {
    let isHidden = hidden;
    const listeners = new Set<Handlers>();
    const each = (event: keyof Handlers): void => {
        [...listeners].forEach(handlers => handlers[event]());
    };

    return {
        page: {
            isHidden: () => isHidden,
            listen: handlers => {
                listeners.add(handlers);
                return () => {
                    listeners.delete(handlers);
                };
            },
        },
        hide: () => {
            isHidden = true;
            each('hidden');
        },
        show: () => {
            isHidden = false;
            each('visible');
        },
        freeze: () => {
            isHidden = true;
            each('frozen');
        },
        listenerCount: () => listeners.size,
    };
};
