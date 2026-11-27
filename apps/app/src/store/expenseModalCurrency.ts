// The starting currency of a new expense (KB EXP-072): one order for a group and a direct target,
// so the two cannot drift. Three concepts stay apart: `lastSelectedCurrency` is the viewer's own
// input preference (per target and overall), `defaultCurrency` the explicit base currency of the
// settings, and the ledger `lastUsedCurrency` of a group or a known user (shared with the other
// members) never takes part.
import { DEFAULT_CURRENCY_CODE } from 'constants/currencies';

import type { ExpenseModalSource, ExpenseTargetMode } from './expenseModalTypes';

/**
 * Where the starting currency came from: the viewer's last selected currency in the target
 * (`context`) or overall (`global`), the default currency of the settings (`default`), or the
 * app's fallback (`fallback`).
 */
export type InputCurrencySource = 'context' | 'global' | 'default' | 'fallback';

export interface InputCurrencyResolution {
    currency: string;
    source: InputCurrencySource;
}

export interface InputCurrencyCandidates {
    /** The viewer's last selected currency in the group or with the known user. */
    contextLastSelectedCurrency?: string | null;
    /** The viewer's last selected currency in any group or with any known user. */
    globalLastSelectedCurrency?: string | null;
    /** The default (base) currency of the viewer's settings. */
    defaultCurrency?: string | null;
    fallbackCurrency: string;
}

/** The first available currency (EXP-072); an absent (null, undefined or empty) one falls through. */
export const resolveInputCurrency = ({
    contextLastSelectedCurrency,
    globalLastSelectedCurrency,
    defaultCurrency,
    fallbackCurrency,
}: InputCurrencyCandidates): InputCurrencyResolution => {
    if (contextLastSelectedCurrency) {
        return { currency: contextLastSelectedCurrency, source: 'context' };
    }
    if (globalLastSelectedCurrency) {
        return { currency: globalLastSelectedCurrency, source: 'global' };
    }
    if (defaultCurrency) {
        return { currency: defaultCurrency, source: 'default' };
    }
    return { currency: fallbackCurrency, source: 'fallback' };
};

/** The target of a new expense in the modal: a group, or a known user (friend). */
export interface ExpenseModalCurrencyTarget {
    targetMode: ExpenseTargetMode;
    groupId: string;
    selectedFriendId: string;
}

/** The starting currency of a new expense in the modal for this target, with its source. */
export const resolveExpenseModalCurrency = (
    source: ExpenseModalSource,
    { targetMode, groupId, selectedFriendId }: ExpenseModalCurrencyTarget,
): InputCurrencyResolution =>
    resolveInputCurrency({
        contextLastSelectedCurrency:
            targetMode === 'friends'
                ? source.knownFriends.find(friend => friend.id === selectedFriendId)
                      ?.lastSelectedCurrency
                : source.groups.find(group => group.id === groupId)?.lastSelectedCurrency,
        globalLastSelectedCurrency: source.lastSelectedCurrency,
        defaultCurrency: source.defaultCurrency,
        fallbackCurrency: DEFAULT_CURRENCY_CODE,
    });
