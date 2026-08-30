import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';

import { ROUTES } from 'constants/routes';
import { resolveApiErrorMessageFromError } from 'helpers/errors';
import { useActivityStore } from 'store/activity-store';
import { selectExpensePayload, selectIsSubmitDisabled } from 'store/expenseModalSelectors';
import { type ExpenseModalSource, useExpenseModalStore } from 'store/expenseModalStore';
import { buildExpenseUpdateParams } from 'store/expenseModalUpdate';
import { useGroupsStore } from 'store/groupsStore';
import { selectExpenseAdding, selectExpenseUpdating } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';
import {
    selectUserCurrency,
    selectUserDefaultCategory,
    selectUserSkipCategory,
    useUsersStore,
} from 'store/users-store';

export const useExpenseModalOpenChange = (isOpened: boolean, onOpenChange: () => void): void => {
    const previousIsOpened = useRef(false);

    useEffect(() => {
        const hasOpenStateChanged = previousIsOpened.current !== isOpened;
        previousIsOpened.current = isOpened;

        if (hasOpenStateChanged) {
            onOpenChange();
        }
    }, [isOpened, onOpenChange]);
};

interface ExpenseModalSourceOptions {
    context?: 'friends';
    friendId?: string;
}

interface ExpenseModalSubmitResult {
    isSubmitDisabled: boolean;
    isSubmitting: boolean;
    onSubmit: () => void;
}

const getExpenseModalContext = (
    context: ExpenseModalSourceOptions['context'],
    pathname: string,
): ExpenseModalSource['context'] => {
    if (context === 'friends' || pathname === ROUTES.FRIENDS) {
        return 'friends';
    }

    if (pathname.startsWith(`${ROUTES.GROUP}/`) && !pathname.startsWith(`${ROUTES.GROUP_JOIN}/`)) {
        return 'group';
    }

    return 'dashboard';
};

export const useExpenseModalSource = ({
    context,
    friendId,
}: ExpenseModalSourceOptions): ExpenseModalSource => {
    const location = useLocation();
    const { user, friends, defaultCurrency, defaultCategory, skipCategory } = useUsersStore(
        useShallow(state => ({
            user: state.user,
            friends: state.friends,
            defaultCurrency: selectUserCurrency(state),
            defaultCategory: selectUserDefaultCategory(state),
            skipCategory: selectUserSkipCategory(state),
        })),
    );

    const { groups, selectedGroup } = useGroupsStore(
        useShallow(state => ({
            groups: state.groups,
            selectedGroup: state.selectedGroup,
        })),
    );
    const openingContext = getExpenseModalContext(context, location.pathname);

    return useMemo(
        () => ({
            context: openingContext,
            currentUser: user,
            defaultCurrency,
            defaultCategory,
            skipCategory,
            groups: groups.map(group => ({
                id: group.id,
                name: group.name,
                members: group.members.map(member => member.user),
            })),
            knownFriends: friends.map(friend => friend.user),
            defaultGroupId: selectedGroup?.id ?? groups[0]?.id,
            preferredFriendId: friendId,
        }),
        [
            defaultCurrency,
            defaultCategory,
            friendId,
            friends,
            groups,
            openingContext,
            selectedGroup?.id,
            skipCategory,
            user,
        ],
    );
};

export const useExpenseModalSubmit = (onClose: () => void): ExpenseModalSubmitResult => {
    const { t } = useTranslation('group');
    const { createExpense, updateExpense } = useActivityStore(
        useShallow(state => ({
            createExpense: state.createExpense,
            updateExpense: state.updateExpense,
        })),
    );
    const isSubmitting = useLoadingStore(
        useShallow(state => selectExpenseAdding(state) || selectExpenseUpdating(state)),
    );
    const isSubmitDisabled = useExpenseModalStore(selectIsSubmitDisabled);

    const onSubmit = useCallback(() => {
        const state = useExpenseModalStore.getState();
        const params = selectExpensePayload(state);

        if (!params) {
            return;
        }

        const onMutationError = (error: unknown) => {
            toast.error(resolveApiErrorMessageFromError(
                error,
                t('toasts:common.requestFailed'),
            ));
        };

        if (state.mode === 'edit' && state.editContext) {
            const update = buildExpenseUpdateParams(state.editContext.original, params);

            if (!update) {
                return;
            }

            updateExpense({
                entryId: state.editContext.entryId,
                entry: update,
                groupId: state.editContext.groupId,
                parentActivityId: state.editContext.parentActivityId,
            })
                .then(() => {
                    onClose();
                    toast.success(t('toasts:expense.updated'));
                })
                .catch(onMutationError);
            return;
        }

        createExpense(params)
            .then(() => {
                onClose();
                toast.success(t('toasts:expense.created'));
            })
            .catch(onMutationError);
    }, [createExpense, onClose, t, updateExpense]);

    return {
        isSubmitDisabled,
        isSubmitting,
        onSubmit,
    };
};
