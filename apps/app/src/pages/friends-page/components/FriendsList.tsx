import { Flex } from '@radix-ui/themes';
import type { ReactNode } from 'react';

import type { FriendCurrencyGroup, KnownUser } from 'entities/users';

import { FriendsPageSkeleton } from 'components/skeletons';

import CurrencyGroupCard from './CurrencyGroupCard';
import FriendInviteEmptyState from './FriendInviteEmptyState';
import SettledUpCard from './SettledUpCard';

interface Props {
    currencyGroups: readonly FriendCurrencyGroup[];
    isEmpty: boolean;
    isLoading: boolean;
    settledFriends: readonly KnownUser[];
}

const FriendsList = ({ currencyGroups, isEmpty, isLoading, settledFriends }: Props) => {
    let content: ReactNode;

    if (isLoading) {
        content = <FriendsPageSkeleton />;
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

export default FriendsList;
