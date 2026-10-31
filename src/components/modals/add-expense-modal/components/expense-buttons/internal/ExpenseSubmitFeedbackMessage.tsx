import { Amount } from 'basics';
import { Trans, useTranslation } from 'react-i18next';

import { EXPENSE_SUBMIT_BLOCKERS } from 'constants/chipin';
import type { ExpenseSubmitFeedback } from 'store/expenseModalSelectors';

interface Props {
    feedback: ExpenseSubmitFeedback;
    currency: string;
}

export const ExpenseSubmitFeedbackMessage = ({ feedback, currency }: Props) => {
    const { t } = useTranslation('group');
    const key = `expenses.modal.submitFeedback.${feedback.reason}`;

    if (
        feedback.reason === EXPENSE_SUBMIT_BLOCKERS.AMOUNTS_UNDER ||
        feedback.reason === EXPENSE_SUBMIT_BLOCKERS.AMOUNTS_OVER
    ) {
        return (
            <Trans
                t={t}
                i18nKey={key}
                components={{
                    current: <Amount value={feedback.current} tokenCode={currency} precision={4} />,
                    required: <Amount value={feedback.required} tokenCode={currency} precision={4} />,
                    difference: <Amount value={feedback.difference} tokenCode={currency} precision={4} />,
                }}
            />
        );
    }

    return t(key, {
        current: feedback.current,
        required: feedback.required,
        difference: feedback.difference,
    });
};
