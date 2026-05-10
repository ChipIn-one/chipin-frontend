import Big from 'bignumber.js';

import { Flex } from '@radix-ui/themes';

import { BalanceEntry } from 'helpers/currencies';

import OwedToYouCard from './summary-debt-cards/OwedToYouCard';
import YouOweCard from './summary-debt-cards/YouOweCard';

interface Props {
    isLoading?: boolean;
    owedToYouTotal: Big;
    youOweTotal: Big;
    owedEntries: BalanceEntry[];
    oweEntries: BalanceEntry[];
    mainCurrency: string;
}

const SummaryDebtCards: React.FC<Props> = ({
    isLoading = false,
    owedToYouTotal,
    youOweTotal,
    owedEntries,
    oweEntries,
    mainCurrency,
}) => {
    return (
        <Flex direction="column" gap="4">
            <OwedToYouCard
                isLoading={isLoading}
                total={owedToYouTotal}
                mainCurrency={mainCurrency}
                entries={owedEntries}
            />

            <YouOweCard
                isLoading={isLoading}
                total={youOweTotal}
                mainCurrency={mainCurrency}
                entries={oweEntries}
            />
        </Flex>
    );
};

export default SummaryDebtCards;
