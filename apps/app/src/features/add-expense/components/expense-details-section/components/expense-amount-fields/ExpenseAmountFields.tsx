import { useId } from 'react';
import { Text, TextField } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import { selectInputFractionDigits } from 'store/expenseModalSelectors';
import { useExpenseModalStore } from 'store/expenseModalStore';

import { AmountInput } from 'basics';

import styles from './ExpenseAmountFields.module.css';

const ExpenseAmountFields = () => {
    const { t } = useTranslation('group');
    const amountId = useId();
    const { amount, fractionDigits, description, setAmount, setDescription } = useExpenseModalStore(
        useShallow(state => ({
            amount: state.amount,
            // The currency minor units; more only while the text already has more (an edit of a
            // scale-4 amount, a currency switch), so the value is kept and can still be erased.
            fractionDigits: selectInputFractionDigits(state, state.amount),
            description: state.description,
            setAmount: state.setAmount,
            setDescription: state.setDescription,
        })),
    );

    return (
        <div className={styles.root}>
            <Text as="label" htmlFor={amountId} size="2" weight="bold" color="gray">
                {t('common:fields.amount')}
            </Text>

            <AmountInput
                className={styles.amountInput}
                id={amountId}
                value={amount}
                onChange={setAmount}
                maxFractionDigits={fractionDigits}
                color="gray"
                size="3"
                autoFocus
            />

            <TextField.Root
                className={styles.descriptionInput}
                type="text"
                size="3"
                variant="surface"
                placeholder={t('expenses.modal.fields.descriptionPlaceholder')}
                aria-label={t('common:fields.description')}
                value={description}
                onChange={event => setDescription(event.target.value)}
            />
        </div>
    );
};

export { ExpenseAmountFields };
