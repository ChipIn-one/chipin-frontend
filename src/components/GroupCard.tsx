import { LucideChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Card, Flex, Text } from '@radix-ui/themes';

import { Group } from 'api/chipin.types';
import { ROUTES } from 'constants/routes';
import { selectGroupNonZeroBalances } from 'store/groupsSelectors';
import { useGroupsStore } from 'store/groupsStore';

import OwedStatusText from 'basics/OwedStatusText';
import GroupAvatar from 'components/GroupAvatar';

interface Props {
    group: Group;
}

const GroupCard: React.FC<Props> = ({ group }) => {
    const { setSelectedGroup } = useGroupsStore();
    const { t } = useTranslation('dashboard');

    const balances = selectGroupNonZeroBalances(group);

    return (
        <Card asChild size="1">
            <Link to={`${ROUTES.GROUP}/${group.id}`} onClick={() => setSelectedGroup(group)}>
                <Flex gap="3" align="center">
                    <GroupAvatar group={group} size="5" />

                    <Flex align="center" justify="between" gap="2" width="100%">
                        <Flex direction="column">
                            <Text size="4" weight="bold" as="p">
                                {group.name}
                            </Text>

                            {balances.map(entry => (
                                <OwedStatusText
                                    key={entry.currency}
                                    value={entry.netBalance}
                                    currencyCode={entry.currency}
                                    size="2"
                                    align="left"
                                />
                            ))}

                            <Text size="1" color="gray" as="p">
                                {t('groupsCard.members', {
                                    count: group?.members?.length,
                                })}
                            </Text>
                        </Flex>
                        <LucideChevronRight size={20} />
                    </Flex>
                </Flex>
            </Link>
        </Card>
    );
};

export default GroupCard;
