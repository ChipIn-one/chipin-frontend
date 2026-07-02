import { LucideChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import { Card, Flex, Text } from '@radix-ui/themes';

import { Group } from 'api/chipin.types';
import { ROUTES } from 'constants/routes';
import { useDashboardStore } from 'store/dashboardStore';
import { selectGroupNonZeroBalances } from 'store/groupsSelectors';
import { useGroupsStore } from 'store/groupsStore';

import BalanceSummaryText from 'basics/BalanceSummaryText';
import { NavButton } from 'basics/buttons';
import GroupAvatar from 'components/GroupAvatar';

const GroupNavButton = styled(NavButton)`
    display: block;
    width: 100%;
`;

interface Props {
    group: Group;
}

const GroupCard: React.FC<Props> = ({ group }) => {
    const { setSelectedGroup } = useGroupsStore();
    const currencies = useDashboardStore(state => state.currencies);
    const { t } = useTranslation('dashboard');

    const balances = selectGroupNonZeroBalances(group, currencies.rates, currencies.base);

    return (
        <GroupNavButton
            to={`${ROUTES.GROUP}/${group.id}`}
            unsetStyles
            onClick={() => setSelectedGroup(group)}
        >
            <Card size="1">
                <Flex gap="3" align="center">
                    <GroupAvatar group={group} size="5" />

                    <Flex align="center" justify="between" gap="2" width="100%">
                        <Flex direction="column">
                            <Text size="4" weight="bold" as="p">
                                {group.name}
                            </Text>

                            <BalanceSummaryText entries={balances} size="2" align="left" />

                            <Text size="1" color="gray" as="p">
                                {t('groupsCard.members', {
                                    count: group?.members?.length,
                                })}
                            </Text>
                        </Flex>
                        <LucideChevronRight size={20} />
                    </Flex>
                </Flex>
            </Card>
        </GroupNavButton>
    );
};

export default GroupCard;
