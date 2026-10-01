import { type ReactElement, useState } from 'react';
import { LucideCirclePlus, LucidePlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import styled from 'styled-components';

import { Box, Button, Tooltip } from '@radix-ui/themes';

import { themeColor } from 'helpers/colors';

import { useConnect } from './add-expense-button/internal/useConnect';

const ButtonMobile = styled(Button)<{ $isSoloMode: boolean; $isUnavailable: boolean }>`
    width: var(--space-9);
    height: var(--space-9);
    padding: 0;
    border: 6px solid ${({ $isSoloMode, $isUnavailable }) =>
        themeColor($isUnavailable ? 'gray7' : $isSoloMode ? 'violet7' : 'grass7')};
`;

interface Props {
    type?: 'mobile' | 'desktop' | 'sidebar';
}

const AddExpenseButton = ({ type = 'desktop' }: Props) => {
    const { t } = useTranslation('common');
    const location = useLocation();
    const [isUnavailableTooltipOpen, setIsUnavailableTooltipOpen] = useState(false);
    const {
        isLoggedIn,
        isSoloMode,
        isUnavailable,
        isButtonLoading,
        unavailableReason,
        onAddExpense,
    } = useConnect(location.pathname);
    const unavailableMessage = unavailableReason
        ? t(`addExpenseUnavailable.${unavailableReason}`)
        : null;

    if (!isLoggedIn) {
        return null;
    }

    const onClick = () => {
        if (isButtonLoading) {
            return;
        }

        if (isUnavailable) {
            setIsUnavailableTooltipOpen(true);
            return;
        }

        onAddExpense();
    };

    const withUnavailableTooltip = (button: ReactElement) => {
        if (!isUnavailable || !unavailableMessage) {
            return button;
        }

        return (
            <Tooltip
                content={unavailableMessage}
                open={isUnavailableTooltipOpen}
                onOpenChange={setIsUnavailableTooltipOpen}
            >
                {button}
            </Tooltip>
        );
    };

    const buttonColor = isUnavailable ? 'gray' : isSoloMode ? 'violet' : 'grass';

    if (type === 'mobile') {
        return withUnavailableTooltip(
            <ButtonMobile
                $isSoloMode={isSoloMode}
                $isUnavailable={isUnavailable}
                size="4"
                radius="full"
                color={buttonColor}
                aria-label={t('buttons.addExpense')}
                aria-disabled={isUnavailable || undefined}
                loading={isButtonLoading}
                onClick={onClick}
            >
                <LucidePlus size={28} />
            </ButtonMobile>,
        );
    }

    const button = withUnavailableTooltip(
        <Button
            size="3"
            radius="large"
            color={buttonColor}
            aria-disabled={isUnavailable || undefined}
            loading={isButtonLoading}
            onClick={onClick}
        >
            <LucideCirclePlus />
            {t('buttons.addExpense')}
        </Button>,
    );

    if (type === 'sidebar') {
        return button;
    }

    return (
        <Box display={{ initial: 'none', sm: 'block', lg: 'none' }}>
            <Box position="fixed" bottom="6" right="6">
                {button}
            </Box>
        </Box>
    );
};

export default AddExpenseButton;
