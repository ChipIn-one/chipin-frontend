import { useTranslation } from 'react-i18next';

import { Badge, Flex, Text } from '@radix-ui/themes';

import type { BalanceEntry } from 'api/chipin.raw.types';
import type { Group } from 'api/chipin.types';
import { ROUTES } from 'constants/routes';
import { useGroupsStore } from 'store/groupsStore';

import BalanceSummaryText from 'basics/BalanceSummaryText';
import GroupAvatar from 'components/GroupAvatar';

import {
    GroupCardSurface,
    GroupNavButton,
} from './styled';

interface Props {
    group: Group;
    balances: BalanceEntry[];
    isSelected?: boolean;
}

const GroupCard = ({ group, balances, isSelected = false }: Props) => {
    const setSelectedGroup = useGroupsStore(state => state.setSelectedGroup);
    const { t } = useTranslation('dashboard');

    return (
        <GroupNavButton
            to={`${ROUTES.GROUP}/${group.id}`}
            unsetStyles
            onClick={() => setSelectedGroup(group)}
            aria-current={isSelected ? 'page' : undefined}
        >
            <GroupCardSurface
                size="1"
                data-interactive-card
                data-selected={isSelected || undefined}
            >
                <Flex direction="column" gap="2">
                    <Flex align="center" gap="2" wrap="wrap">
                        <Text size="4" weight="bold">
                            {group.name}
                        </Text>
                        <Badge color="gray" size="1" variant="solid">
                            {t('groupsCard.members', {
                                count: group?.members?.length,
                            })}
                        </Badge>
                    </Flex>
                    <Flex gap="2" align="center">
                        <GroupAvatar group={group} size="4" />
                        <Flex direction="column" minWidth="0">
                            <BalanceSummaryText entries={balances} size="2" align="left" />
                        </Flex>
                    </Flex>
                </Flex>
            </GroupCardSurface>
        </GroupNavButton>
    );
};

export default GroupCard;
