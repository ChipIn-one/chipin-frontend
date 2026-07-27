import { useTranslation } from 'react-i18next';

import { Button, Flex } from '@radix-ui/themes';

import { useExpenseModalSubmit } from '../../internal';

interface Props {
    onClose: () => void;
}

const ExpenseButtons = ({ onClose }: Props) => {
    const { t } = useTranslation('group');
    const { isSubmitDisabled, isSubmitting, onSubmit } =
        useExpenseModalSubmit(onClose);

    return (
        <Flex justify="end" gap="3">
            <Button size="3" variant="soft" color="gray" onClick={onClose}>
                {t('common:buttons.cancel')}
            </Button>

            <Button
                size="3"
                variant="solid"
                disabled={isSubmitDisabled || isSubmitting}
                loading={isSubmitting}
                onClick={onSubmit}
            >
                {t('common:buttons.addExpense')}
            </Button>
        </Flex>
    );
};

export default ExpenseButtons;
