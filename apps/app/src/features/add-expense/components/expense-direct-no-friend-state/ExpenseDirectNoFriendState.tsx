import { Button, Flex } from '@radix-ui/themes';
import { RefreshCwIcon, UserPlusIcon, UsersIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import { useFriendInvite } from 'hooks/pwaHooks';
import { useSelfUserState } from 'hooks/useSelfUser';
import { selectDirectExpenseFallbackGroupId } from 'store/expenseModalSelectors';
import { useExpenseModalStore } from 'store/expenseModalStore';

import { NoDirectFriendEmptyState } from 'basics/empty-states';

/**
 * KB EXP-067: a direct expense with no mutual known user. In place of the payer and split controls:
 * why it is unavailable and the personal invite (share, else copy, as on the Friends page); it
 * creates no user, expense or relationship. A group that can take the expense is offered instead.
 */
const ExpenseDirectNoFriendState = () => {
    const { t } = useTranslation('group');
    const { user, isLoading, refetch } = useSelfUserState();
    const inviteToken = user?.inviteToken;
    const invite = useFriendInvite(inviteToken ?? '');
    const { fallbackGroupId, setGroupId } = useExpenseModalStore(
        useShallow(state => ({
            fallbackGroupId: selectDirectExpenseFallbackGroupId(state),
            setGroupId: state.setGroupId,
        })),
    );

    const onInvite = (): Promise<void> =>
        invite.isNativeShareSupported ? invite.onShare() : invite.onCopyLink();

    // USR-013: without an invite token the self user did not load: Retry reloads it.
    const action =
        isLoading || inviteToken ? (
            <Button
                type="button"
                size="3"
                variant="solid"
                loading={isLoading}
                onClick={() => void onInvite()}
            >
                <UserPlusIcon size={18} />
                {t('expenses.modal.directNoFriend.inviteAction')}
            </Button>
        ) : (
            <Button type="button" variant="soft" onClick={() => void refetch()}>
                <RefreshCwIcon size={14} />
                {t('activity:retryAction')}
            </Button>
        );

    return (
        <Flex direction="column" gap="3">
            <NoDirectFriendEmptyState action={action} />

            {fallbackGroupId && (
                <Flex justify="center">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                            setGroupId(fallbackGroupId);
                        }}
                    >
                        <UsersIcon size={14} />
                        {t('expenses.modal.directNoFriend.groupAction')}
                    </Button>
                </Flex>
            )}
        </Flex>
    );
};

export { ExpenseDirectNoFriendState };
