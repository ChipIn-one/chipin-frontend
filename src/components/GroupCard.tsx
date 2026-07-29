import { LucideChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import { Card, Flex, Text } from '@radix-ui/themes';

import type { BalanceEntry } from 'api/chipin.raw.types';
import type { Group } from 'api/chipin.types';
import { ROUTES } from 'constants/routes';
import { interactiveCardLinkStyles } from 'helpers/interactiveCardStyles';
import { useGroupsStore } from 'store/groupsStore';

import BalanceSummaryText from 'basics/BalanceSummaryText';
import { NavButton } from 'basics/buttons';
import GroupAvatar from 'components/GroupAvatar';

const GroupNavButton = styled(NavButton)`
    ${interactiveCardLinkStyles({
        hover: {
            backgroundColorToken: 'grayA3',
            borderColorToken: 'grayA6',
        },
        focus: {
            borderColorToken: 'grayA6',
            focusColorToken: 'grassA8',
        },
        selected: {
            state: {
                backgroundColorToken: 'grassA3',
                borderColorToken: 'grassA8',
            },
            hover: {
                backgroundColorToken: 'grassA4',
                borderColorToken: 'grassA8',
            },
            focus: {
                borderColorToken: 'grassA8',
                focusColorToken: 'grassA8',
            },
        },
    })}
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
            <Card size="1" data-interactive-card>
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
