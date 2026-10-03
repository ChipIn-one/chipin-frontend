import type { ReactNode } from 'react';

import { Flex } from '@radix-ui/themes';

import type { KnownUser } from 'api/chipin.types';
import type { FriendCurrencyGroup } from 'store/users-store';

import { FriendsPageSkeleton } from 'components/skeletons';

import CurrencyGroupCard from './CurrencyGroupCard';
import FriendInviteEmptyState from './FriendInviteEmptyState';
import SettledUpCard from './SettledUpCard';

interface Props {
    currencyGroups: FriendCurrencyGroup[];
    isEmpty: boolean;
    isLoading: boolean;
    settledFriends: KnownUser[];
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
                        netBalance={group.netBalance}
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
