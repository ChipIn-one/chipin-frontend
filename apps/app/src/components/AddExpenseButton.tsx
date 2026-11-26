import { Box, Button } from '@radix-ui/themes';
import { CirclePlusIcon, PlusIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

import { useAddExpenseAvailability } from 'hooks/useAddExpenseAvailability';
import { useExpenseModalStore } from 'store/expenseModalStore';

import styles from './AddExpenseButton.module.css';

interface Props {
    type?: 'mobile' | 'desktop' | 'sidebar';
}

const AddExpenseButton = ({ type = 'desktop' }: Props) => {
    const { t } = useTranslation('common');
    const location = useLocation();
    const { isSoloMode, isVisible } = useAddExpenseAvailability(location.pathname);
    const openExpenseModal = useExpenseModalStore(state => state.open);

    if (!isVisible) {
        return null;
    }

    const buttonColor = isSoloMode ? 'violet' : 'grass';
    const onClickAddExpense = () => {
        openExpenseModal();
    };

    if (type === 'mobile') {
        return (
            <Button
                className={styles.root}
                data-variant={isSoloMode ? 'solo' : 'group'}
                type="button"
                size="4"
                radius="full"
                color={buttonColor}
                aria-label={t('buttons.addExpense')}
                onClick={onClickAddExpense}
            >
                <PlusIcon size={28} />
            </Button>
        );
    }

    const addExpenseButton = (
        <Button
            type="button"
            size="3"
            radius="large"
            color={buttonColor}
            onClick={onClickAddExpense}
        >
            <CirclePlusIcon />
            {t('buttons.addExpense')}
        </Button>
    );

    if (type === 'sidebar') {
        return addExpenseButton;
    }

    return (
        <Box display={{ initial: 'none', sm: 'block', lg: 'none' }}>
            <Box position="fixed" bottom="6" right="6">
                {addExpenseButton}
            </Box>
        </Box>
    );
};

export { AddExpenseButton };
