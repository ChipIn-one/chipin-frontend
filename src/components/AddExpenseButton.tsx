import { LucideCirclePlus, LucidePlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import styled from 'styled-components';

import { Box, Button } from '@radix-ui/themes';

import { ROUTES } from 'constants/routes';
import { themeColor } from 'helpers/colors';
import { selectIsLoggedIn } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';

import AddExpenseModal from 'components/Modal/AddExpenseModal';

const FloatingBox = styled(Box)`
    bottom: var(--space-6);
    right: var(--space-4);
`;

const ButtonMobile = styled(Button)`
    width: var(--space-9);
    height: var(--space-9);
    padding: 0;
    border: 6px solid ${themeColor('grass7')};
`;

interface Props {
    type?: 'mobile' | 'desktop';
}

const AddExpenseButton = ({ type = 'desktop' }: Props) => {
    const { t } = useTranslation('group');
    const location = useLocation();
    const isLoggedIn = useAuthStore(selectIsLoggedIn);

    const isVisibleRoute = location.pathname !== ROUTES.SETTINGS;

    if (!isLoggedIn || !isVisibleRoute) {
        return null;
    }

    if (type === 'mobile') {
        return (
            <ButtonMobile
                size="4"
                radius="full"
                color="jade"
                aria-label={t('expenses.modal.submit')}
            >
                <LucidePlus size={28} />
            </ButtonMobile>
        );
    }

    return (
        <Box display={{ initial: 'none', sm: 'block' }}>
            <AddExpenseModal>
                <FloatingBox position="fixed" right="6">
                    <Button size="3" radius="full" color="jade">
                        <LucideCirclePlus />
                        {t('expenses.modal.submit')}
                    </Button>
                </FloatingBox>
            </AddExpenseModal>
        </Box>
    );
};

export default AddExpenseButton;
