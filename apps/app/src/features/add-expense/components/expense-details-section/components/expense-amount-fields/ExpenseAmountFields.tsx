import { useId } from 'react';
import { PROP_COLOR } from '@chipin/tokens/theme';
import { Text, TextField } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import { EXPENSE_SUBMIT_BLOCKERS } from 'constants/chipin';
import {
    selectExpenseSubmitFeedback,
    selectInputFractionDigits,
} from 'store/expenseModalSelectors';
import { useExpenseModalStore } from 'store/expenseModalStore';

import { AmountInput } from 'basics';

import styles from './ExpenseAmountFields.module.css';

const ExpenseAmountFields = () => {
    const { t } = useTranslation('group');
    const amountId = useId();
    const amountErrorId = `${amountId}-error`;
    const { amount, fractionDigits, description, isAmountBlocking, setAmount, setDescription } =
        useExpenseModalStore(
            useShallow(state => ({
                amount: state.amount,
                // The currency minor units; more only while the text already has more (an edit of a
                // scale-4 amount, a currency switch), so the value is kept and can still be erased.
                fractionDigits: selectInputFractionDigits(state, state.amount),
                description: state.description,
                // KB EXP-064: when the amount is the first blocking condition, its one explanation
                // sits below the amount field (ExpenseButtons leaves it out of the form-level status).
                isAmountBlocking:
                    selectExpenseSubmitFeedback(state)?.reason === EXPENSE_SUBMIT_BLOCKERS.AMOUNT,
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
                aria-invalid={isAmountBlocking}
                aria-describedby={isAmountBlocking ? amountErrorId : undefined}
                color="gray"
                size="3"
                autoFocus
            />

            {/* Polite and always mounted: the blocker is visible from open, and an alert would be
                announced assertively when the dialog mounts and again with the focused input. */}
            <div className={styles.amountMessage} aria-live="polite" aria-atomic="true">
                {isAmountBlocking && (
                    <Text as="p" id={amountErrorId} size="2" color={PROP_COLOR.danger} m="0">
                        {t('expenses.modal.submitFeedback.amount')}
                    </Text>
                )}
            </div>

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
