import { LucideCircleCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Card, Flex, Separator, Text } from '@radix-ui/themes';

import type { Friend } from 'api/chipin.types';

import { UserAvatar } from 'basics/index';

import FriendActionsDropdown from './FriendActionsDropdown';

interface Props {
    friends: Friend[];
}

const SettledUpCard = ({ friends }: Props) => {
    const { t } = useTranslation('common');

    return (
        <Card>
            <Flex align="center" gap="2" mb="3">
                <LucideCircleCheck size={24} />
                <Text weight="bold" as="span" size="3" color="gray">
                    {t('balances.settledUp')}
                </Text>
            </Flex>
            <Flex direction="column" gap="3">
                {friends.map((friend, index) => (
                    <Flex key={friend.user.id} direction="column" gap="3">
                        {index === 0 && <Separator size="4" />}
                        <Flex justify="between" align="center">
                            <Flex align="center" gap="3">
                                <UserAvatar user={friend.user} size={{ initial: '1', sm: '2' }} />
                                <Text as="span" weight="medium" size={{ initial: '2', sm: '3' }}>
                                    {friend.user.displayName}
                                </Text>
                            </Flex>
                            <FriendActionsDropdown />
                        </Flex>
                    </Flex>
                ))}
            </Flex>
        </Card>
    );
};

export default SettledUpCard;
