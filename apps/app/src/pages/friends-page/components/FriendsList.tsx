import { Flex } from '@radix-ui/themes';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { FriendCurrencyGroup, KnownUser } from 'entities/users';

import { LoadErrorEmptyState, OfflineEmptyState } from 'basics/empty-states';
import { FriendsPageSkeleton } from 'components/skeletons';

import CurrencyGroupCard from './CurrencyGroupCard';
import { FriendInviteEmptyState } from './FriendInviteEmptyState';
import SettledUpCard from './SettledUpCard';

interface Props {
    currencyGroups: readonly FriendCurrencyGroup[];
    isEmpty: boolean;
    /** The first load failed with nothing cached. */
    isError: boolean;
    isLoading: boolean;
    /** The first load waits for the network with nothing cached. */
    isOffline: boolean;
    onRetry: () => void;
    settledFriends: readonly KnownUser[];
}

// USR-013: loading -> skeleton, a failed first load -> error with Retry, offline with nothing
// cached -> offline notice (the page banner has Retry), then the list or the invite onboarding.
const FriendsList = ({
    currencyGroups,
    isEmpty,
    isError,
    isLoading,
    isOffline,
    onRetry,
    settledFriends,
}: Props) => {
    const { t } = useTranslation('friends');
    let content: ReactNode;

    if (isLoading) {
        content = <FriendsPageSkeleton />;
    } else if (isOffline) {
        content = <OfflineEmptyState />;
    } else if (isError) {
        content = (
            <LoadErrorEmptyState
                title={t('loadErrorTitle')}
                description={t('loadErrorDescription')}
                onRetry={onRetry}
            />
        );
    } else if (isEmpty) {
        content = <FriendInviteEmptyState />;
    } else {
        content = (
            <>
                {currencyGroups.map(group => (
                    <CurrencyGroupCard
                        key={group.currency}
                        currency={group.currency}
                        net={group.net}
                        friends={group.friends}
                    />
                ))}

                {settledFriends.length > 0 && <SettledUpCard friends={settledFriends} />}
            </>
        );
    }

    return (
        <Flex direction="column" gap="4">
            {content}
        </Flex>
    );
};

export { FriendsList };
