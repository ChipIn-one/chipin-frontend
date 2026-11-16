import { Fragment } from 'react';
import { Flex, Text } from '@radix-ui/themes';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import type { BalanceEntry } from 'api/chipin.raw.types';

import { Amount } from './numbers';

const AmountChunk = styled.span`
    white-space: nowrap;
`;

interface Props {
    /** Balances split by sign (entities/balance `legacyPartitionEntries`); zero ones are dropped. */
    balances: {
        readonly owed: readonly BalanceEntry[];
        readonly owe: readonly BalanceEntry[];
    };
    size: ComponentProps<typeof Text>['size'];
    align?: ComponentProps<typeof Text>['align'];
}

const BalanceSummaryText = ({ balances, size, align = 'left' }: Props) => {
    const { t } = useTranslation('common');
    const { owed: owedEntries, owe: oweEntries } = balances;

    if (owedEntries.length === 0 && oweEntries.length === 0) {
        return (
            <Text size={size} color="gray" as="span" align={align}>
                {t('balances.settledUp')}
            </Text>
        );
    }

    return (
        <Flex direction="column">
            {owedEntries.length > 0 && (
                <Text size={size} color="green" as="span" weight="medium" align={align}>
                    {t('balances.youAreOwed')}{' '}
                    {owedEntries.map((entry, i) => (
                        <Fragment key={entry.currency}>
                            <AmountChunk>
                                <Amount
                                    type="summary"
                                    value={Math.abs(entry.netBalance)}
                                    tokenCode={entry.currency}
                                    precision={2}
                                />
                                {i < owedEntries.length - 1 && ','}
                            </AmountChunk>
                            {i < owedEntries.length - 1 && ' '}
                        </Fragment>
                    ))}
                </Text>
            )}
            {oweEntries.length > 0 && (
                <Text size={size} color="red" as="span" weight="medium" align={align}>
                    {t('balances.youOwe')}{' '}
                    {oweEntries.map((entry, i) => (
                        <Fragment key={entry.currency}>
                            <AmountChunk>
                                <Amount
                                    type="summary"
                                    value={Math.abs(entry.netBalance)}
                                    tokenCode={entry.currency}
                                    precision={2}
                                />
                                {i < oweEntries.length - 1 && ','}
                            </AmountChunk>
                            {i < oweEntries.length - 1 && ' '}
                        </Fragment>
                    ))}
                </Text>
            )}
        </Flex>
    );
};

export default BalanceSummaryText;
