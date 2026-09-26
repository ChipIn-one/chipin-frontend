import { Amount, UserAvatar } from 'basics';
import {
    LucideArrowDownLeft,
    LucideArrowUpRight,
    LucideChevronDown,
    LucideChevronRight,
    LucideChevronUp,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Flex, Text } from '@radix-ui/themes';

import type { DebtOption } from '../internal';
import { DebtButton, ShowMoreButton } from '../styled';

const COLLAPSED_DEBT_COUNT = 3;

interface Props {
    debts: DebtOption[];
    isExpanded: boolean;
    isUserOwing: boolean;
    onToggle: () => void;
    onSelect: (debt: DebtOption) => void;
}

const DebtSection = ({ debts, isExpanded, isUserOwing, onToggle, onSelect }: Props) => {
    const { t } = useTranslation('group');

    if (debts.length === 0) {
        return null;
    }

    const visibleDebts = isExpanded ? debts : debts.slice(0, COLLAPSED_DEBT_COUNT);
    const hiddenDebtCount = debts.length - visibleDebts.length;
    const hasCollapsibleDebts = debts.length > COLLAPSED_DEBT_COUNT;
    const color = isUserOwing ? 'red' : 'green';
    const DirectionIcon = isUserOwing ? LucideArrowUpRight : LucideArrowDownLeft;

    return (
        <Flex direction="column" gap="2">
            <Flex align="center" gap="2" px="2" mb="1">
                <Text color={color} asChild>
                    <DirectionIcon size={18} />
                </Text>
                <Text size="3" weight="bold" color={color}>
                    {t(
                        isUserOwing
                            ? 'group:page.settleUp.youOwe'
                            : 'group:page.settleUp.owedToYou',
                    )}
                </Text>
            </Flex>

            {visibleDebts.map(debt => (
                <DebtButton
                    key={`${debt.user.id}-${debt.balance.currency}`}
                    type="button"
                    size="3"
                    variant="soft"
                    color="gray"
                    onClick={() => onSelect(debt)}
                >
                    <Flex align="center" justify="between" gap="3" width="100%">
                        <Flex align="center" gap="3" minWidth="0">
                            <UserAvatar user={debt.user} size="3" />
                            <Text weight="bold" size="2" truncate>
                                {debt.user.displayName}
                            </Text>
                        </Flex>

                        <Flex align="center" gap="2" flexShrink="0">
                            <Text weight="bold" size="3" color={color}>
                                <Amount
                                    value={Math.abs(debt.balance.netAmount)}
                                    tokenCode={debt.balance.currency}
                                    precision={2}
                                    type="summary"
                                />
                            </Text>
                            <LucideChevronRight size={18} />
                        </Flex>
                    </Flex>
                </DebtButton>
            ))}

            {hasCollapsibleDebts && (
                <ShowMoreButton
                    type="button"
                    variant="ghost"
                    color={color}
                    onClick={onToggle}
                >
                    {isExpanded
                        ? t('group:page.settleUp.showLess')
                        : t('group:page.settleUp.showMore', { count: hiddenDebtCount })}
                    {isExpanded ? (
                        <LucideChevronUp size={16} />
                    ) : (
                        <LucideChevronDown size={16} />
                    )}
                </ShowMoreButton>
            )}
        </Flex>
    );
};

export default DebtSection;
