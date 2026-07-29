import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';

import { ROUTES } from 'constants/routes';
import { getUnixTimestampInSec } from 'helpers/time';
import { useActivityStore } from 'store/activity-store';
import {
    selectExpensePayload,
    selectIsSubmitDisabled,
} from 'store/expenseModalSelectors';
import { type ExpenseModalSource, useExpenseModalStore } from 'store/expenseModalStore';
import { useGroupsStore } from 'store/groupsStore';
import { selectExpenseAdding } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';
import { selectUserCurrency } from 'store/usersSelectors';
import { useUsersStore } from 'store/usersStore';

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
    const { user, friends, defaultCurrency } = useUsersStore(
        useShallow(state => ({
            user: state.user,
            friends: state.friends,
            defaultCurrency: selectUserCurrency(state),
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
            groups: groups.map(group => ({
                id: group.id,
                members: group.members.map(member => member.user),
            })),
            knownFriends: friends.map(friend => friend.user),
            defaultGroupId: selectedGroup?.id ?? groups[0]?.id,
            preferredFriendId: friendId,
        }),
        [
            defaultCurrency,
            friendId,
            friends,
            groups,
            openingContext,
            selectedGroup?.id,
            user,
        ],
    );
};

export const useExpenseModalSubmit = (onClose: () => void): ExpenseModalSubmitResult => {
    const { t } = useTranslation('group');
    const createExpense = useActivityStore(state => state.createExpense);
    const isSubmitting = useLoadingStore(selectExpenseAdding);
    const isSubmitDisabled = useExpenseModalStore(
        selectIsSubmitDisabled,
    );
    const onSubmit = useCallback(() => {
        const params = selectExpensePayload(
            useExpenseModalStore.getState(),
            getUnixTimestampInSec(),
        );

        if (!params) {
            return;
        }

        createExpense(params)
            .then(() => {
                onClose();
                toast.success(t('toasts:expense.created'));
            })
            .catch((error: unknown) => {
                toast.error(t('toasts:expense.createError'));
                console.error('Error creating expense:', error);
            });
    }, [createExpense, onClose, t]);

    return {
        isSubmitDisabled,
        isSubmitting,
        onSubmit,
    };
};
