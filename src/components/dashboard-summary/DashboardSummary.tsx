import { useState } from 'react';
import { LucideChevronDown, LucideChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Card, Flex, Separator, Skeleton, Text, VisuallyHidden } from '@radix-ui/themes';

import { BalanceBadges } from 'basics';
import DebtAmount from 'basics/DebtAmount';
import { Amount } from 'basics/numbers';

import { useConnect } from './internal';
import { SummaryCardSurface, SummaryToggleButton } from './styled';

interface Props {
    isLoading?: boolean;
}

const SUMMARY_DETAILS_ID = 'dashboard-balance-summary-details';

const DashBoardSummary = ({ isLoading = false }: Props) => {
    const { t } = useTranslation('dashboard');
    const { t: tSkeletons } = useTranslation('skeletons');
    const [isExpanded, setIsExpanded] = useState(false);
    const {
        netTotalInBase,
        owedTotalInBase,
        owingTotalInBase,
        owedEntries,
        oweEntries,
        defaultCurrency,
    } = useConnect();

    const owedBadgeItems = owedEntries
        .filter(entry => entry.netBalance > 0)
        .map(entry => ({
            tokenCode: entry.currency,
            value: entry.netBalance,
            color: 'grass' as const,
        }));
    const oweBadgeItems = oweEntries
        .filter(entry => entry.netBalance < 0)
        .map(entry => ({
            tokenCode: entry.currency,
            value: Math.abs(entry.netBalance),
            color: 'tomato' as const,
        }));
    const hasOwed = owedBadgeItems.length > 0;
    const hasOwing = oweBadgeItems.length > 0;
    const hasDetails = hasOwed || hasOwing;
    const showOwed = isLoading || hasOwed;
    const showOwing = isLoading || hasOwing;

    const summaryContent = (
        <Flex align="center" justify="between" gap="3" width="100%" minWidth="0">
            <Flex direction="column" gap="1" minWidth="0">
                <Text size="4" weight="medium" color="gray" as="span">
                    <Skeleton loading={isLoading}>{t('summary.totalBalance')}</Skeleton>
                </Text>

                <DebtAmount
                    amountProps={{ type: 'summary' }}
                    isLoading={isLoading}
                    amount={netTotalInBase ?? 0}
                    currency={defaultCurrency}
                    size="7"
                    weight="bold"
                />
            </Flex>

            <Flex align="center" gap="2" flexShrink="0">
                <Flex direction="column" gap="1" align="end">
                    {showOwed && (
                        <Text color="grass" size="2" weight="bold">
                            <Skeleton loading={isLoading}>
                                {isLoading ? (
                                    tSkeletons('debtAmount.amount')
                                ) : (
                                    <>
                                        <VisuallyHidden>{t('summary.owedToYou')}</VisuallyHidden>
                                        <Amount
                                            type="summary"
                                            value={owedTotalInBase}
                                            tokenCode={defaultCurrency}
                                            precision={0}
                                        />
                                    </>
                                )}
                            </Skeleton>
                        </Text>
                    )}

                    {showOwing && (
                        <Text color="tomato" size="2" weight="bold">
                            <Skeleton loading={isLoading}>
                                {isLoading ? (
                                    tSkeletons('debtAmount.amount')
                                ) : (
                                    <>
                                        <VisuallyHidden>{t('summary.youOwe')}</VisuallyHidden>
                                        <Amount
                                            type="summary"
                                            value={owingTotalInBase}
                                            tokenCode={defaultCurrency}
                                            precision={0}
                                        />
                                    </>
                                )}
                            </Skeleton>
                        </Text>
                    )}
                </Flex>

                {hasDetails &&
                    !isLoading &&
                    (isExpanded ? (
                        <LucideChevronUp size={18} aria-hidden />
                    ) : (
                        <LucideChevronDown size={18} aria-hidden />
                    ))}
            </Flex>
        </Flex>
    );

    const summaryCard = (
        <SummaryCardSurface size="1" data-interactive-card>
            {summaryContent}
        </SummaryCardSurface>
    );

    if (!hasDetails || isLoading) {
        return summaryCard;
    }

    return (
        <Flex direction="column" gap="2">
            <SummaryToggleButton
                type="button"
                aria-expanded={isExpanded}
                aria-controls={SUMMARY_DETAILS_ID}
                onClick={() => setIsExpanded(expanded => !expanded)}
            >
                {summaryCard}
                <VisuallyHidden>
                    {t(
                        isExpanded
                            ? 'summary.hideBalanceDetails'
                            : 'summary.showBalanceDetails',
                    )}
                </VisuallyHidden>
            </SummaryToggleButton>

            {isExpanded && (
                <Card size="1">
                    <Flex direction="column" gap="3">
                        <Separator size="4" />
                        <Flex
                            id={SUMMARY_DETAILS_ID}
                            direction={{ initial: 'column', sm: 'row' }}
                            gap="3"
                        >
                            {hasOwed && (
                                <Flex direction="column" gap="1" flexGrow="1" minWidth="0">
                                    <Text color="grass" size="2" weight="medium">
                                        {t('summary.owedToYou')}
                                    </Text>
                                    <BalanceBadges items={owedBadgeItems} showSingle />
                                </Flex>
                            )}

                            {hasOwing && (
                                <Flex direction="column" gap="1" flexGrow="1" minWidth="0">
                                    <Text color="tomato" size="2" weight="medium">
                                        {t('summary.youOwe')}
                                    </Text>
                                    <BalanceBadges items={oweBadgeItems} showSingle />
                                </Flex>
                            )}
                        </Flex>
                    </Flex>
                </Card>
            )}
        </Flex>
    );
};

export default DashBoardSummary;
