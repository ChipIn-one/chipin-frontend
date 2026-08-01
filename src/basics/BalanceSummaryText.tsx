import { ComponentProps, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import { Flex, Text } from '@radix-ui/themes';

import { BalanceEntry } from 'api/chipin.raw.types';

import { Amount } from './numbers';

const AmountChunk = styled.span`
    white-space: nowrap;
`;

interface Props {
    entries: BalanceEntry[];
    size: ComponentProps<typeof Text>['size'];
    align?: ComponentProps<typeof Text>['align'];
}

const BalanceSummaryText = ({ entries, size, align = 'left' }: Props) => {
    const { t } = useTranslation('common');

    const owedEntries = entries.filter(e => e.netBalance > 0);
    const oweEntries = entries.filter(e => e.netBalance < 0);

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
                    {t('balances.youOwed')}{' '}
                    {owedEntries.map((entry, i) => (
                        <Fragment key={entry.currency}>
                            <AmountChunk>
                                <Amount
                                    type="summary"
                                    value={Math.abs(entry.netBalance!)}
                                    tokenCode={entry.currency}
                                    precision={0}
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
                                    value={Math.abs(entry.netBalance!)}
                                    tokenCode={entry.currency}
                                    precision={0}
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
