import { useMemo, useState } from 'react';
import { PROP_COLOR } from '@chipin/tokens/theme';
import { Card, Flex, Skeleton, Text, VisuallyHidden } from '@radix-ui/themes';
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { EMPTY_CURRENCY_RATES, useCurrencyRatesQuery } from 'entities/currency-rates';
import type { DashboardBalances } from 'entities/dashboard';
import { useDashboardBalancesQuery } from 'entities/dashboard';
import { userCurrency } from 'entities/users';
import { useUserSetting } from 'hooks/useSelfUser';

import { BalanceBadges } from 'basics';
import DebtAmount from 'basics/DebtAmount';
import { NoDebtsEmptyState } from 'basics/empty-states';
import { Amount } from 'basics/numbers';
import { OutboxBalanceCaption } from 'components/outbox-balance-caption';

import { summarizeDashboard } from './summary';

import styles from './DashboardSummary.module.css';

interface Props {
    isLoading?: boolean;
    hasExpenseHistory?: boolean;
}

const SUMMARY_DETAILS_ID = 'dashboard-balance-summary-details';
const NO_BALANCES: DashboardBalances = [];

const DashboardSummary = ({ isLoading = false, hasExpenseHistory = false }: Props) => {
    const { t } = useTranslation('dashboard');
    const [isExpanded, setIsExpanded] = useState(false);
    const defaultCurrency = useUserSetting(userCurrency);
    const { data: balances = NO_BALANCES } = useDashboardBalancesQuery();
    const { data: currencyRates = EMPTY_CURRENCY_RATES } = useCurrencyRatesQuery();
    const { netTotalInBase, owedTotalInBase, owingTotalInBase, owedBadgeItems, oweBadgeItems } =
        useMemo(
            () => summarizeDashboard(balances, currencyRates, defaultCurrency),
            [balances, currencyRates, defaultCurrency],
        );
    const hasOwed = owedBadgeItems.length > 0;
    const hasOwing = oweBadgeItems.length > 0;
    const hasDetails = hasOwed || hasOwing;

    const summaryContent = (
        <Flex align="center" justify="between" gap="3" width="100%" minWidth="0">
            <Flex direction="column" gap="1" minWidth="0">
                <Text size="4" weight="medium" color={PROP_COLOR.neutral} as="span">
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
                        <Text color={PROP_COLOR.debtOwed} size="2" weight="bold">
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
                        <Text color={PROP_COLOR.debtOwing} size="2" weight="bold">
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
                        <ChevronUpIcon size={18} aria-hidden />
                    ) : (
                        <ChevronDownIcon size={18} aria-hidden />
                    ))}
            </Flex>
        </Flex>
    );

    const detailsContent = (
        <Flex direction="column" gap="3">
            <Flex id={SUMMARY_DETAILS_ID} direction="column" gap="3">
                {hasOwing && (
                    <Flex direction="column" gap="1" minWidth="0">
                        <Text color={PROP_COLOR.debtOwing} size="3" weight="bold">
                            {t('summary.youOwe')}
                        </Text>
                        <BalanceBadges items={oweBadgeItems} />
                    </Flex>
                )}

                {hasOwed && (
                    <Flex direction="column" gap="1" minWidth="0">
                        <Text color={PROP_COLOR.debtOwed} size="3" weight="bold">
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

    // §3: the caption is a sibling (the summary card may be a button), shown only with unsent ops.
    if (netTotalInBase === 0) {
        if (!hasDetails) {
            return (
                <>
                    {hasExpenseHistory ? <NoDebtsEmptyState /> : null}
                    <OutboxBalanceCaption />
                </>
            );
        }

        return (
            <>
                <Card size="1">{detailsContent}</Card>
                <OutboxBalanceCaption />
            </>
        );
    }

    if (!hasDetails) {
        return (
            <>
                {summaryCard}
                <OutboxBalanceCaption />
            </>
        );
    }

    return (
        <Flex direction="column" gap="2">
            <Card asChild size="1">
                <button
                    className={styles.summaryButton}
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
                </button>
            </Card>

            {isExpanded && <Card size="1">{detailsContent}</Card>}
            <OutboxBalanceCaption />
        </Flex>
    );
};

export { DashboardSummary };
