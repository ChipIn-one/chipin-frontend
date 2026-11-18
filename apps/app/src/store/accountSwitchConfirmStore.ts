import { create } from 'zustand';

/**
 * The account-switch dialog of spec 03 §1.5, the row "sign-in of Y" (03-16a part C): UI state only.
 * The auth store asks (`requestAccountSwitchConfirm`) and waits; the OAuth callback page, which
 * hosts the exchange, shows the question and answers it.
 */
export interface AccountSwitchConfirmStore {
    /** The open question: X's unsent operations (null: they could not be counted). */
    request: { count: number | null } | null;
    /** The user's answer: true deletes X's data and signs Y in, false signs Y out. */
    answer: (isConfirmed: boolean) => void;
}

let pendingAnswer: ((isConfirmed: boolean) => void) | null = null;

export const useAccountSwitchConfirmStore = create<AccountSwitchConfirmStore>(set => ({
    request: null,
    answer: isConfirmed => {
        const resolve = pendingAnswer;

        pendingAnswer = null;
        set({ request: null });
        resolve?.(isConfirmed);
    },
}));

/**
 * Shows the dialog and resolves the answer. A newer question replaces an unanswered one, which
 * resolves false (nothing is deleted without an answer).
 */
export const requestAccountSwitchConfirm = (count: number | null): Promise<boolean> => {
    pendingAnswer?.(false);
    return new Promise(resolve => {
        pendingAnswer = resolve;
        useAccountSwitchConfirmStore.setState({ request: { count } });
    });
};
