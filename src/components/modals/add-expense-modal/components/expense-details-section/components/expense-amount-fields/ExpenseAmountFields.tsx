import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import { Text } from '@radix-ui/themes';

import { useExpenseModalStore } from 'store/expenseModalStore';

import { AmountBox, DescriptionInput, LargeAmountInput } from './styled';

const ExpenseAmountFields = () => {
    const { t } = useTranslation('group');
    const { amount, description, setAmount, setDescription } =
        useExpenseModalStore(
            useShallow(state => ({
                amount: state.amount,
                description: state.description,
                setAmount: state.setAmount,
                setDescription: state.setDescription,
            })),
        );

    return (
        <AmountBox>
            <Text as="label" size="2" weight="bold" color="gray">
                {t('common:fields.amount')}
            </Text>

            <LargeAmountInput
                value={amount}
                onChange={setAmount}
                color="gray"
                size="3"
                autoFocus
            />

            <DescriptionInput
                type="text"
                size="3"
                variant="surface"
                placeholder={t('expenses.modal.fields.descriptionPlaceholder')}
                value={description}
                onChange={event => setDescription(event.target.value)}
            />
        </AmountBox>
    );
};

export default ExpenseAmountFields;
