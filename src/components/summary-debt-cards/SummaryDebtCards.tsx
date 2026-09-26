import { Flex } from '@radix-ui/themes';

import { BalanceEntry } from 'api/chipin.raw.types';

import { NoDebtsEmptyState } from 'basics/empty-states';

import OwedToYouCard from './OwedToYouCard';
import YouOweCard from './YouOweCard';

interface Props {
    isLoading?: boolean;
    owedToYouTotal: number | null;
    youOweTotal: number | null;
    owedEntries: BalanceEntry[];
    oweEntries: BalanceEntry[];
    defaultCurrency: string;
}

const SummaryDebtCards: React.FC<Props> = ({
    isLoading = false,
    owedToYouTotal,
    youOweTotal,
    owedEntries,
    oweEntries,
    defaultCurrency,
}) => {
    return (
        <Flex direction="column" gap="4">
            {!owedEntries.length && !oweEntries.length && !isLoading && <NoDebtsEmptyState />}
            <OwedToYouCard
                isLoading={isLoading}
                total={owedToYouTotal}
                defaultCurrency={defaultCurrency}
                entries={owedEntries}
            />

            <YouOweCard
                isLoading={isLoading}
                total={youOweTotal}
                defaultCurrency={defaultCurrency}
                entries={oweEntries}
            />
        </Flex>
    );
};

export default SummaryDebtCards;
