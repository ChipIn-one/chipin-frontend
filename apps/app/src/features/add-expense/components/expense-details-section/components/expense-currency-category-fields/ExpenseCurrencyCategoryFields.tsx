import { useId } from 'react';
import { PROP_COLOR } from '@chipin/tokens/theme';
import { Flex, Text } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import { selectCurrencySourceNote } from 'store/expenseModalSelectors';
import { useExpenseModalStore } from 'store/expenseModalStore';

import CurrencySelect from 'components/CurrencySelect';
import { CategorySearchSelect } from 'components/search-select';

import { ExpensePayerSearchSelect } from '../../../expense-payer-search-select/ExpensePayerSearchSelect';
import { ExpenseSearchSelectContent } from '../../../expense-search-select-content/ExpenseSearchSelectContent';

const ExpenseCurrencyCategoryFields = () => {
    const { t } = useTranslation('group');
    const currencySourceId = useId();
    const { currency, currencySource, category, skipCategory, setCurrency, setCategory } =
        useExpenseModalStore(
            useShallow(state => ({
                currency: state.currency,
                currencySource: selectCurrencySourceNote(state),
                category: state.category,
                skipCategory: state.source.skipCategory && state.mode === 'create',
                setCurrency: state.setCurrency,
                setCategory: state.setCategory,
            })),
        );

    return (
        <Flex direction="column" justify="between" gap="3" height="100%">
            <Flex direction="column" gap="1" minWidth="0">
                <CurrencySelect
                    currency={currency}
                    triggerElement={
                        <ExpenseSearchSelectContent
                            title={t('common:fields.currency')}
                            value={currency}
                            aria-describedby={currencySource ? currencySourceId : undefined}
                        />
                    }
                    onChange={setCurrency}
                />

                {/* KB EXP-074: where the automatic currency came from; wraps on narrow screens. */}
                {currencySource ? (
                    <Text
                        as="p"
                        id={currencySourceId}
                        size="2"
                        color={PROP_COLOR.neutral}
                        m="0"
                        wrap="pretty"
                    >
                        {t(`expenses.modal.currencySource.${currencySource}`)}
                    </Text>
                ) : null}
            </Flex>

            {skipCategory ? (
                <ExpensePayerSearchSelect />
            ) : (
                <CategorySearchSelect
                    value={category}
                    renderTrigger={selectedCategory => (
                        <ExpenseSearchSelectContent
                            icon={selectedCategory?.icon}
                            title={t('common:fields.category')}
                            value={selectedCategory?.label ?? t('common:fields.category')}
                        />
                    )}
                    onChange={setCategory}
                />
            )}
        </Flex>
    );
};

export default ExpenseCurrencyCategoryFields;
