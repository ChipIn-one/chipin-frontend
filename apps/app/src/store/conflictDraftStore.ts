import { create } from 'zustand';

/**
 * The reopening of a conflict draft (spec 03 §2.6, 03-16b): UI state only. "Open my changes" (the
 * toast, `OutboxSheet`) asks the expense history of the entry to open its edit form
 * (`requestedEntryId`); the form opened on a draft marks it (`openedEntryId`: "your unsaved
 * changes", "Discard my changes"). The draft itself lives in the outbox.
 */
export interface ConflictDraftStore {
    requestedEntryId: string | null;
    openedEntryId: string | null;
    requestOpen: (entryId: string) => void;
    clearRequest: () => void;
    setOpened: (entryId: string | null) => void;
    reset: () => void;
}

export const useConflictDraftStore = create<ConflictDraftStore>(set => ({
    requestedEntryId: null,
    openedEntryId: null,
    requestOpen: entryId => {
        set({ requestedEntryId: entryId });
    },
    clearRequest: () => {
        set({ requestedEntryId: null });
    },
    setOpened: entryId => {
        set({ openedEntryId: entryId });
    },
    reset: () => {
        set({ requestedEntryId: null, openedEntryId: null });
    },
}));
