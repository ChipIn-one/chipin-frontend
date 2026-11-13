import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';

import { ROUTES } from 'constants/routes';
import { userCurrency, userDefaultCategory, userSkipCategory } from 'entities/users';
import { useGroups } from 'hooks/useGroupsList';
import { useKnownUsers } from 'hooks/useKnownUsers';
import {
    toastLedgerWriteError,
    useCreateExpense,
    useUpdateExpense,
} from 'hooks/useLedgerMutations';
import { useSelfUser, useUserSetting } from 'hooks/useSelfUser';
import { selectExpensePayload, selectIsSubmitDisabled } from 'store/expenseModalSelectors';
import { type ExpenseModalSource, useExpenseModalStore } from 'store/expenseModalStore';
import { buildExpenseUpdateParams } from 'store/expenseModalUpdate';
import { selectLastGroupId, useUiPrefsStore } from 'store/ui-prefs';

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
    const user = useSelfUser();
    const { friends } = useKnownUsers();
    const defaultCurrency = useUserSetting(userCurrency);
    const defaultCategory = useUserSetting(userDefaultCategory);
    const skipCategory = useUserSetting(userSkipCategory);

    const groups = useGroups();
    const selectedGroupId = useUiPrefsStore(selectLastGroupId);
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
                lastUsedCurrency: group.lastUsedCurrency,
            })),
            knownFriends: friends?.map(friend => friend.user) ?? [],
            defaultGroupId: selectedGroupId ?? groups[0]?.id,
            preferredFriendId: friendId,
        }),
        [
            defaultCurrency,
            defaultCategory,
            friendId,
            friends,
            groups,
            openingContext,
            selectedGroupId,
            skipCategory,
            user,
        ],
    );
};

export const useExpenseModalSubmit = (onClose: () => void): ExpenseModalSubmitResult => {
    const { t } = useTranslation('group');
    const { createExpense, isPending: isCreating } = useCreateExpense();
    const { updateExpense, isPending: isUpdating } = useUpdateExpense();
    const isSubmitting = isCreating || isUpdating;
    const isSubmitDisabled = useExpenseModalStore(selectIsSubmitDisabled);

    const onSubmit = useCallback(() => {
        const state = useExpenseModalStore.getState();
        const params = selectExpensePayload(state);

        if (!params) {
            return;
        }

        // A refusal (offline, an ended session) and a failed request alike: the modal stays open
        // with the form as it is, and only this session's own outcome is shown.
        const onMutationError = (error: unknown) => {
            toastLedgerWriteError(error, t('toasts:common.requestFailed'));
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

        createExpense({ expense: params })
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
