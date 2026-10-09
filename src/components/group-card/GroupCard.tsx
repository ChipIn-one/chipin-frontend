import { useTranslation } from 'react-i18next';

import { Badge, Flex, Text, VisuallyHidden } from '@radix-ui/themes';

import { GROUP_NET_CONVERSION_STATES } from 'constants/groups';
import { ROUTES } from 'constants/routes';
import type { GroupCardViewModel } from 'store/groupsSelectors';
import { useGroupsStore } from 'store/groupsStore';

import { Amount } from 'basics/numbers';
import GroupAvatar from 'components/GroupAvatar';

import {
    GroupCardSurface,
    GroupNavButton,
} from './styled';

interface Props {
    model: GroupCardViewModel;
    isSelected?: boolean;
}

const GroupCard = ({ model, isSelected = false }: Props) => {
    const setSelectedGroup = useGroupsStore(state => state.setSelectedGroup);
    const { t } = useTranslation('dashboard');
    const { t: tCommon } = useTranslation('common');
    const { group } = model;

    let amountColor: 'green' | 'red' | 'gray' = 'gray';

    if (model.netAmount !== null && model.netAmount > 0) {
        amountColor = 'green';
    } else if (model.netAmount !== null && model.netAmount < 0) {
        amountColor = 'red';
    }

    const directionAmount =
        model.netAmount ??
        (model.activeCurrencyCount === 1
            ? model.sourceCurrencyBalance?.netBalance ?? null
            : null);
    const directionLabel =
        !model.isSettled && directionAmount !== null && directionAmount !== 0
            ? tCommon(
                  directionAmount > 0
                      ? 'balances.youAreOwed'
                      : 'balances.youOwe',
              )
            : null;

    let secondaryBadge = null;

    if (
        !model.isSettled &&
        model.activeCurrencyCount === 1 &&
        model.sourceCurrencyBalance &&
        model.sourceCurrencyBalance.currency !== model.netCurrency
    ) {
        secondaryBadge = (
            <Badge color="gray" size="1" variant="soft">
                <Amount
                    value={model.sourceCurrencyBalance.netBalance}
                    tokenCode={model.sourceCurrencyBalance.currency}
                    precision={2}
                    type="summary"
                />
            </Badge>
        );
    } else if (!model.isSettled && model.activeCurrencyCount > 1) {
        secondaryBadge = (
            <Badge color="gray" size="1" variant="soft">
                {t('groupsCard.currencies', { count: model.activeCurrencyCount })}
            </Badge>
        );
    }

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
                <Flex align="center" gap="3" width="100%" minWidth="0">
                    <GroupAvatar group={group} size="4" />
                    <Flex
                        direction="column"
                        gap="1"
                        minWidth="0"
                        flexGrow="1"
                        flexShrink="1"
                    >
                        <Text size="3" weight="bold" truncate>
                            {group.name}
                        </Text>
                        <Text size="1" color="gray" truncate>
                            {t('groupsCard.members', { count: group.members.length })}
                        </Text>
                    </Flex>
                    <Flex
                        direction="column"
                        align="end"
                        gap="1"
                        flexShrink="0"
                        maxWidth="48%"
                    >
                        {model.isSettled ? (
                            <Badge color="gray" size="1" variant="soft">
                                {t('groupsCard.settled')}
                            </Badge>
                        ) : (
                            <>
                                <Text
                                    size="3"
                                    weight="bold"
                                    color={amountColor}
                                    as="span"
                                    align="right"
                                >
                                    {model.netAmount === null ? (
                                        <>
                                            {t('groupsCard.unavailable')}
                                            {directionLabel && (
                                                <VisuallyHidden>
                                                    {directionLabel}
                                                </VisuallyHidden>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <Amount
                                                value={model.netAmount}
                                                customPrefix={
                                                    model.conversionState ===
                                                    GROUP_NET_CONVERSION_STATES.CONVERTED
                                                        ? '~'
                                                        : undefined
                                                }
                                                tokenCode={model.netCurrency}
                                                precision={2}
                                                type="summary"
                                            />
                                            {directionLabel && (
                                                <VisuallyHidden>
                                                    {directionLabel}
                                                </VisuallyHidden>
                                            )}
                                        </>
                                    )}
                                </Text>
                                {secondaryBadge}
                            </>
                        )}
                    </Flex>
                </Flex>
            </GroupCardSurface>
        </GroupNavButton>
    );
};

export default GroupCard;
