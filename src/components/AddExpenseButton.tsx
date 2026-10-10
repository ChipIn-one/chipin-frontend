import { LucideCirclePlus, LucidePlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import styled from 'styled-components';

import { Box, Button } from '@radix-ui/themes';

import { themeColor } from 'helpers/colors';

import { useConnect } from './add-expense-button/internal/useConnect';

const ButtonMobile = styled(Button)<{ $isSoloMode: boolean }>`
    width: var(--space-9);
    height: var(--space-9);
    padding: 0;
    border: 6px solid ${({ $isSoloMode }) =>
        themeColor($isSoloMode ? 'violet7' : 'grass7')};
`;

interface Props {
    type?: 'mobile' | 'desktop' | 'sidebar';
}

const AddExpenseButton = ({ type = 'desktop' }: Props) => {
    const { t } = useTranslation('common');
    const location = useLocation();
    const { isSoloMode, isVisible, openExpenseModal } =
        useConnect(location.pathname);

    if (!isVisible) {
        return null;
    }

    const buttonColor = isSoloMode ? 'violet' : 'grass';
    const onClickAddExpense = () => {
        openExpenseModal();
    };

    if (type === 'mobile') {
        return (
            <ButtonMobile
                $isSoloMode={isSoloMode}
                type="button"
                size="4"
                radius="full"
                color={buttonColor}
                aria-label={t('buttons.addExpense')}
                onClick={onClickAddExpense}
            >
                <LucidePlus size={28} />
            </ButtonMobile>
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
            <LucideCirclePlus />
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

export default AddExpenseButton;
