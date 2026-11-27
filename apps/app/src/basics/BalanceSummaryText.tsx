import { Fragment } from 'react';
import { PROP_COLOR } from '@chipin/tokens/theme';
import { Flex, Text } from '@radix-ui/themes';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';

import { Amount } from './numbers';

import styles from './BalanceSummaryText.module.css';

/** One currency's net balance, structurally the API `BalanceEntry` (basics may not import `api`). */
interface BalanceSummaryEntry {
    readonly currency: string;
    readonly netBalance: number;
}

interface Props {
    /** Balances split by sign (entities/balance `legacyPartitionEntries`); zero ones are dropped. */
    balances: {
        readonly owed: readonly BalanceSummaryEntry[];
        readonly owe: readonly BalanceSummaryEntry[];
    };
    size: ComponentProps<typeof Text>['size'];
    align?: ComponentProps<typeof Text>['align'];
}

const BalanceSummaryText = ({ balances, size, align = 'left' }: Props) => {
    const { t } = useTranslation('common');
    const { owed: owedEntries, owe: oweEntries } = balances;

    if (owedEntries.length === 0 && oweEntries.length === 0) {
        return (
            <Text size={size} color={PROP_COLOR.debtSettled} as="span" align={align}>
                {t('balances.settledUp')}
            </Text>
        );
    }

    return (
        <Flex direction="column">
            {owedEntries.length > 0 && (
                <Text
                    size={size}
                    color={PROP_COLOR.debtOwed}
                    as="span"
                    weight="medium"
                    align={align}
                >
                    {t('balances.youAreOwed')}{' '}
                    {owedEntries.map((entry, i) => (
                        <Fragment key={entry.currency}>
                            <span className={styles.amountChunk}>
                                <Amount
                                    type="summary"
                                    value={Math.abs(entry.netBalance)}
                                    tokenCode={entry.currency}
                                    precision={2}
                                />
                                {i < owedEntries.length - 1 && ','}
                            </span>
                            {i < owedEntries.length - 1 && ' '}
                        </Fragment>
                    ))}
                </Text>
            )}
            {oweEntries.length > 0 && (
                <Text
                    size={size}
                    color={PROP_COLOR.debtOwing}
                    as="span"
                    weight="medium"
                    align={align}
                >
                    {t('balances.youOwe')}{' '}
                    {oweEntries.map((entry, i) => (
                        <Fragment key={entry.currency}>
                            <span className={styles.amountChunk}>
                                <Amount
                                    type="summary"
                                    value={Math.abs(entry.netBalance)}
                                    tokenCode={entry.currency}
                                    precision={2}
                                />
                                {i < oweEntries.length - 1 && ','}
                            </span>
                            {i < oweEntries.length - 1 && ' '}
                        </Fragment>
                    ))}
                </Text>
            )}
        </Flex>
    );
};

export { BalanceSummaryText };
