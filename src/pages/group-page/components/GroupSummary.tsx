import { legacyRatesFromDecimals } from 'entities/balance';
import { EMPTY_CURRENCY_RATES, useCurrencyRatesQuery } from 'entities/currency-rates';
import { userCurrency } from 'entities/users';
import { useUserSetting } from 'hooks/useSelfUser';
import { calcGroupSummary, selectGroupBalances } from 'store/groupsSelectors';
import { useGroupsStore } from 'store/groupsStore';

import { SummaryDebtCards } from 'components/summary-debt-cards';

const EMPTY_GROUP_SUMMARY: ReturnType<typeof calcGroupSummary> = {
    owedTotalInBase: 0,
    owingTotalInBase: 0,
    netTotalInBase: 0,
    owedEntries: [],
    oweEntries: [],
};

interface Props {
    isLoading: boolean;
}

const GroupSummary = ({ isLoading }: Props) => {
    const selectedGroup = useGroupsStore(state => state.selectedGroup);
    const defaultCurrency = useUserSetting(userCurrency);
    const { data: currencyRates = EMPTY_CURRENCY_RATES } = useCurrencyRatesQuery();
    const { owedTotalInBase, owingTotalInBase, owedEntries, oweEntries } = selectedGroup
        ? calcGroupSummary(
              selectGroupBalances(selectedGroup),
              currencyRates.base,
              legacyRatesFromDecimals(currencyRates.rates),
              defaultCurrency,
          )
        : EMPTY_GROUP_SUMMARY;

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
