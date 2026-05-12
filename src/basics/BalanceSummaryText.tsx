import { ComponentProps, Fragment } from 'react';
import { useTranslation } from 'react-i18next';

import { Flex, Text } from '@radix-ui/themes';

import { BalanceEntry } from 'api/chipin.types';

import { Amount } from './numbers';

interface Props {
    entries: BalanceEntry[];
    size: ComponentProps<typeof Text>['size'];
    align?: ComponentProps<typeof Text>['align'];
}

const BalanceSummaryText = ({ entries, size, align = 'left' }: Props) => {
    const { t } = useTranslation('common');

    const owedEntries = entries.filter(e => e.netBalance !== null && e.netBalance.gt(0));
    const oweEntries = entries.filter(e => e.netBalance !== null && e.netBalance.lt(0));

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
                <Text size={size} color="green" as="span" align={align}>
                    {t('balances.youOwed')}{' '}
                    {owedEntries.map((entry, i) => (
                        <Fragment key={entry.currency}>
                            {i > 0 && ', '}
                            <Amount
                                value={entry.netBalance!.abs()}
                                tokenCode={entry.currency}
                                precision={0}
                            />
                        </Fragment>
                    ))}
                </Text>
            )}
            {oweEntries.length > 0 && (
                <Text size={size} color="red" as="span" align={align}>
                    {t('balances.youOwe')}{' '}
                    {oweEntries.map((entry, i) => (
                        <Fragment key={entry.currency}>
                            {i > 0 && ', '}
                            <Amount
                                value={entry.netBalance!.abs()}
                                tokenCode={entry.currency}
                                precision={0}
                            />
                        </Fragment>
                    ))}
                </Text>
            )}
        </Flex>
    );
};

export default BalanceSummaryText;
