import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import { Flex } from '@radix-ui/themes';

import { useExpenseModalStore } from 'store/expenseModalStore';

import CurrencySelect from 'components/CurrencySelect';
import { CategorySearchSelect } from 'components/search-select';

import { ExpensePayerSearchSelect } from '../../../expense-payer-search-select';
import { ExpenseSearchSelectContent } from '../../../expense-search-select-content';

const ExpenseCurrencyCategoryFields = () => {
    const { t } = useTranslation('group');
    const { currency, category, skipCategory, setCurrency, setCategory } =
        useExpenseModalStore(
            useShallow(state => ({
                currency: state.currency,
                category: state.category,
                skipCategory: state.source.skipCategory && state.mode === 'create',
                setCurrency: state.setCurrency,
                setCategory: state.setCategory,
            })),
        );

    return (
        <Flex direction="column" justify="between" gap="3" height="100%">
            <CurrencySelect
                currency={currency}
                triggerElement={
                    <ExpenseSearchSelectContent
                        title={t('common:fields.currency')}
                        value={currency}
                    />
                }
                onChange={setCurrency}
            />

            {skipCategory ? (
                <ExpensePayerSearchSelect />
            ) : (
                <CategorySearchSelect
                    value={category}
                    renderTrigger={selectedCategory => (
                        <ExpenseSearchSelectContent
                            icon={selectedCategory?.icon}
                            title={t('common:fields.category')}
                            value={
                                selectedCategory?.label ??
                                t('common:fields.category')
                            }
                        />
                    )}
                    onChange={setCategory}
                />
            )}
        </Flex>
    );
};

export default ExpenseCurrencyCategoryFields;
