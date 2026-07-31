import { useTranslation } from 'react-i18next';

import { Button } from '@radix-ui/themes';

import { OverlayFooter } from '../../../components';
import { useExpenseModalSubmit } from '../../internal';

interface Props {
    onClose: () => void;
}

const ExpenseButtons = ({ onClose }: Props) => {
    const { t } = useTranslation('group');
    const { isSubmitDisabled, isSubmitting, onSubmit } =
        useExpenseModalSubmit(onClose);

    return (
        <OverlayFooter
            cancelAction={
                <Button size="3" variant="soft" color="gray" onClick={onClose}>
                    {t('common:buttons.cancel')}
                </Button>
            }
            primaryAction={
                <Button
                    size="3"
                    variant="solid"
                    disabled={isSubmitDisabled || isSubmitting}
                    loading={isSubmitting}
                    onClick={onSubmit}
                >
                    {t('common:buttons.addExpense')}
                </Button>
            }
        />
    );
};

export default ExpenseButtons;
