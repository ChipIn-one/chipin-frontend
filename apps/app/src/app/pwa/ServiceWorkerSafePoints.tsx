// Spec 04 §2.11 item 3 (04-2d): inside the app shell (under the router and the user's query client),
// reports route changes and the safety check of a forced update to `ServiceWorkerManager`. A safe
// point is a route change or `visible`, with no open modal with a dirty draft,
// `queryClient.isMutating() === 0`, and no outbox operation in `sending` (C3-12; with offline writes
// off the outbox never sends, so that condition holds).
import { useEffect, useRef } from 'react';
import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';

import { outboxSendingOpId } from 'shared/offline/outboxStore';
import { type ExpenseModalState, useExpenseModalStore } from 'store/expenseModalStore';

import { notifyRouteChange, setSafePointCheck } from './safePoint';

/**
 * An open expense modal holds a draft worth keeping: any edit form, or a create form the user
 * typed a description or an amount into.
 */
export const hasDirtyExpenseDraft = (
    state: Pick<ExpenseModalState, 'isOpened' | 'mode' | 'description' | 'amount'>,
): boolean =>
    state.isOpened &&
    (state.mode === 'edit' || state.description.trim() !== '' || state.amount.trim() !== '');

/** The safety check of the app shell for `queryClient` (the client of the signed-in user). */
export const isAppSafeToReload = (queryClient: QueryClient): boolean =>
    queryClient.isMutating() === 0 &&
    outboxSendingOpId() === null &&
    !hasDirtyExpenseDraft(useExpenseModalStore.getState());

export const ServiceWorkerSafePoints = () => {
    const queryClient = useQueryClient();
    const { pathname } = useLocation();
    const previousPathname = useRef(pathname);

    useEffect(() => {
        setSafePointCheck(() => isAppSafeToReload(queryClient));

        return () => {
            setSafePointCheck(null);
        };
    }, [queryClient]);

    useEffect(() => {
        if (previousPathname.current !== pathname) {
            previousPathname.current = pathname;
            notifyRouteChange();
        }
    }, [pathname]);

    return null;
};
