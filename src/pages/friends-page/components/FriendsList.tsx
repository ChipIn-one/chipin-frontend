import { LucideUserPlus } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Flex } from '@radix-ui/themes';

import type { KnownUser } from 'api/chipin.types';
import type { FriendCurrencyGroup } from 'store/users-store';

import { NoFriendsEmptyState } from 'basics/empty-states';
import { FriendsPageSkeleton } from 'components/skeletons';

import CurrencyGroupCard from './CurrencyGroupCard';
import SettledUpCard from './SettledUpCard';

interface Props {
    currencyGroups: FriendCurrencyGroup[];
    isEmpty: boolean;
    isLoading: boolean;
    settledFriends: KnownUser[];
}

const FriendsList = ({ currencyGroups, isEmpty, isLoading, settledFriends }: Props) => {
    const { t } = useTranslation('common');
    let content: ReactNode;

    if (isLoading) {
        content = <FriendsPageSkeleton />;
    } else if (isEmpty) {
        content = (
            <NoFriendsEmptyState
                action={
                    <Button size="2" variant="soft">
                        <LucideUserPlus size={14} />
                        {t('buttons.addFriend')}
                    </Button>
                }
            />
        );
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
