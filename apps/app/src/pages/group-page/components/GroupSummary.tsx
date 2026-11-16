import { legacyRatesFromDecimals } from 'entities/balance';
import { EMPTY_CURRENCY_RATES, useCurrencyRatesQuery } from 'entities/currency-rates';
import type { Group } from 'entities/groups';
import { userCurrency } from 'entities/users';
import { useUserSetting } from 'hooks/useSelfUser';
import { calcGroupSummary, selectGroupBalances } from 'store/groupsSelectors';

import { SummaryDebtCards } from 'components/summary-debt-cards';

interface Props {
    group: Group;
    isLoading: boolean;
}

const GroupSummary = ({ group, isLoading }: Props) => {
    const defaultCurrency = useUserSetting(userCurrency);
    const { data: currencyRates = EMPTY_CURRENCY_RATES } = useCurrencyRatesQuery();
    const { owedTotalInBase, owingTotalInBase, owedEntries, oweEntries } = calcGroupSummary(
        selectGroupBalances(group),
        currencyRates.base,
        legacyRatesFromDecimals(currencyRates.rates),
        defaultCurrency,
    );

    return (
        <SummaryDebtCards
            isLoading={isLoading}
            owedToYouTotal={owedTotalInBase}
            youOweTotal={owingTotalInBase}
            owedEntries={owedEntries}
            oweEntries={oweEntries}
            defaultCurrency={defaultCurrency}
        />
    );
};

export default GroupSummary;
