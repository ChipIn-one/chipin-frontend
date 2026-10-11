import { useState } from 'react';
import { LucideChevronDown, LucideChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Card, Flex, Skeleton, Text, VisuallyHidden } from '@radix-ui/themes';

import { BalanceBadges } from 'basics';
import { NoDebtsEmptyState } from 'basics/empty-states';
import DebtAmount from 'basics/DebtAmount';
import { Amount } from 'basics/numbers';

import { useConnect } from './internal';
import { SummaryCardButton } from './styled';

interface Props {
    isLoading?: boolean;
    hasExpenseHistory?: boolean;
}

const SUMMARY_DETAILS_ID = 'dashboard-balance-summary-details';

const DashBoardSummary = ({ isLoading = false, hasExpenseHistory = false }: Props) => {
    const { t } = useTranslation('dashboard');
    const [isExpanded, setIsExpanded] = useState(false);
    const {
        netTotalInBase,
        owedTotalInBase,
        owingTotalInBase,
        owedBadgeItems,
        oweBadgeItems,
        defaultCurrency,
    } = useConnect();
    const hasOwed = owedBadgeItems.length > 0;
    const hasOwing = oweBadgeItems.length > 0;
    const hasDetails = hasOwed || hasOwing;

    const summaryContent = (
        <Flex align="center" justify="between" gap="3" width="100%" minWidth="0">
            <Flex direction="column" gap="1" minWidth="0">
                <Text size="4" weight="medium" color="gray" as="span">
                    {t('summary.totalBalance')}
                </Text>

                <DebtAmount
                    amountProps={{ type: 'summary' }}
                    amount={netTotalInBase ?? 0}
                    currency={defaultCurrency}
                    size="7"
                    weight="bold"
                />
            </Flex>

            <Flex align="center" gap="2" flexShrink="0">
                <Flex direction="column" gap="1" align="end">
                    {hasOwed && (
                        <Text color="grass" size="2" weight="bold">
                            <VisuallyHidden>{t('summary.owedToYou')}</VisuallyHidden>
                            <Amount
                                type="summary"
                                value={owedTotalInBase}
                                tokenCode={defaultCurrency}
                                precision={0}
                            />
                        </Text>
                    )}

                    {hasOwing && (
                        <Text color="tomato" size="2" weight="bold">
                            <VisuallyHidden>{t('summary.youOwe')}</VisuallyHidden>
                            <Amount
                                type="summary"
                                value={owingTotalInBase}
                                tokenCode={defaultCurrency}
                                precision={0}
                            />
                        </Text>
                    )}
                </Flex>

                {hasDetails &&
                    (isExpanded ? (
                        <LucideChevronUp size={18} aria-hidden />
                    ) : (
                        <LucideChevronDown size={18} aria-hidden />
                    ))}
            </Flex>
        </Flex>
    );

    const detailsContent = (
                    <Flex direction="column" gap="3">
                        <Flex
                            id={SUMMARY_DETAILS_ID}
                            direction="column"
                            gap="3"
                        >
                            {hasOwing && (
                                <Flex direction="column" gap="1" minWidth="0">
                                    <Text color="tomato" size="3" weight="bold">
                                        {t('summary.youOwe')}
                                    </Text>
                                    <BalanceBadges items={oweBadgeItems} />
                                </Flex>
                            )}

                            {hasOwed && (
                                <Flex direction="column" gap="1" minWidth="0">
                                    <Text color="grass" size="3" weight="bold">
                                        {t('summary.owedToYou')}
                                    </Text>
                                    <BalanceBadges items={owedBadgeItems} />
                                </Flex>
                            )}
                        </Flex>
                    </Flex>
    );

    const summaryCard = <Card size="1">{summaryContent}</Card>;

    if (isLoading) {
        return <Skeleton loading>{summaryCard}</Skeleton>;
    }

    if (netTotalInBase === 0) {
        if (!hasDetails) {
            return hasExpenseHistory ? <NoDebtsEmptyState /> : null;
        }

        return <Card size="1">{detailsContent}</Card>;
    }

    if (!hasDetails) {
        return summaryCard;
    }

    return (
        <Flex direction="column" gap="2">
            <Card asChild size="1">
                <SummaryCardButton
                    type="button"
                    aria-expanded={isExpanded}
                    aria-controls={SUMMARY_DETAILS_ID}
                    onClick={() => setIsExpanded(expanded => !expanded)}
                >
                    {summaryContent}
                    <VisuallyHidden>
                        {t(
                            isExpanded
                                ? 'summary.hideBalanceDetails'
                                : 'summary.showBalanceDetails',
                        )}
                    </VisuallyHidden>
                </SummaryCardButton>
            </Card>

            {isExpanded && (
                <Card size="1">{detailsContent}</Card>
            )}
        </Flex>
    );
};

export default DashBoardSummary;
