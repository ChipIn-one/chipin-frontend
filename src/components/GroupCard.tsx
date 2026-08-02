import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import { Badge, Card, Flex, Text } from '@radix-ui/themes';

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
                <Flex gap="2" direction="column">
                    <Flex align="center" gap="2">
                        <Text size="4" weight="bold" as="p">
                            {group.name}
                        </Text>
                        <Badge color="gray" size="1">
                            {t('groupsCard.members', {
                                count: group?.members?.length,
                            })}
                        </Badge>
                    </Flex>
                    <Flex gap="3" align="center">
                        <GroupAvatar group={group} size="4" />

                        <Flex align="center" justify="between" gap="2" width="100%">
                            <Flex direction="column">
                                <BalanceSummaryText entries={balances} size="2" align="left" />
                            </Flex>
                        </Flex>
                    </Flex>
                </Flex>
            </Card>
        </GroupNavButton>
    );
};

export default GroupCard;
