import { create } from 'zustand';

/**
 * Whether `OutboxSheet` (spec 03 §2.5, 03-16a part B) is open: UI state only. The header badge and
 * the counter at every balance (§3) open it; the sheet itself is mounted once, in the layout.
 */
export interface OutboxSheetStore {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

export const useOutboxSheetStore = create<OutboxSheetStore>(set => ({
    isOpen: false,
    setIsOpen: isOpen => {
        set({ isOpen });
    },
}));
