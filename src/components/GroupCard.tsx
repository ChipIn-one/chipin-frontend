import { LucideChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import { Card, Flex, Text } from '@radix-ui/themes';

import type { BalanceEntry } from 'api/chipin.raw.types';
import type { Group } from 'api/chipin.types';
import { ROUTES } from 'constants/routes';
import { useGroupsStore } from 'store/groupsStore';

import BalanceSummaryText from 'basics/BalanceSummaryText';
import { NavButton } from 'basics/buttons';
import GroupAvatar from 'components/GroupAvatar';
import { interactiveCardStyles } from 'components/interactive-card-styles';

const GroupNavButton = styled(NavButton)`
    display: block;
    width: 100%;
`;

const InteractiveCard = styled(Card)<{ $isSelected: boolean }>`
    ${interactiveCardStyles.transition}

    ${({ $isSelected }) =>
        $isSelected &&
        interactiveCardStyles.state({
            backgroundColorToken: 'grassA3',
            borderColorToken: 'grassA8',
        })}

    ${GroupNavButton}:hover & {
        ${({ $isSelected }) =>
            interactiveCardStyles.hover({
                backgroundColorToken: $isSelected ? 'grassA4' : 'grayA3',
                borderColorToken: $isSelected ? 'grassA8' : 'grayA6',
            })}
    }

    ${GroupNavButton}:focus-visible & {
        ${({ $isSelected }) =>
            interactiveCardStyles.focus({
                borderColorToken: $isSelected ? 'grassA8' : 'grayA6',
                focusColorToken: 'grassA8',
            })}
    }
`;

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
