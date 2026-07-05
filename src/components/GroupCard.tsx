import { LucideChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import styled, { css } from 'styled-components';

import { Card, Flex, Text } from '@radix-ui/themes';

import { Group } from 'api/chipin.types';
import { ROUTES } from 'constants/routes';
import { themeColor } from 'helpers/colors';
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

const InteractiveCard = styled(Card)<{ $isSelected: boolean }>`
    transition:
        background-color 120ms ease,
        box-shadow 120ms ease,
        transform 120ms ease;

    ${({ $isSelected }) =>
        $isSelected &&
        css`
            background-color: ${themeColor('grassA3')};
            box-shadow: inset 0 0 0 1px ${themeColor('grassA8')};
        `}

    ${GroupNavButton}:hover & {
        background-color: ${({ $isSelected, theme }) =>
            $isSelected ? theme.colors.grassA4 : theme.colors.grayA3};
        box-shadow: inset 0 0 0 1px
            ${({ $isSelected, theme }) =>
                $isSelected ? theme.colors.grassA8 : theme.colors.grayA6};
        transform: translateY(-1px);
    }

    ${GroupNavButton}:focus-visible & {
        box-shadow:
            inset 0 0 0 1px
                ${({ $isSelected, theme }) =>
                    $isSelected ? theme.colors.grassA8 : theme.colors.grayA6},
            0 0 0 2px ${themeColor('grassA8')};
    }
`;

interface Props {
    group: Group;
    isSelected?: boolean;
}

const GroupCard: React.FC<Props> = ({ group, isSelected = false }) => {
    const { setSelectedGroup } = useGroupsStore();
    const currencies = useDashboardStore(state => state.currencies);
    const { t } = useTranslation('dashboard');

    const balances = selectGroupNonZeroBalances(group, currencies.rates, currencies.base);

    return (
        <GroupNavButton
            to={`${ROUTES.GROUP}/${group.id}`}
            unsetStyles
            onClick={() => setSelectedGroup(group)}
            aria-current={isSelected ? 'page' : undefined}
        >
            <InteractiveCard size="1" $isSelected={isSelected}>
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
            </InteractiveCard>
        </GroupNavButton>
    );
};

export default GroupCard;
