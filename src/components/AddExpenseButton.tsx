import { LucideCirclePlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import styled from 'styled-components';

import { Box, Button } from '@radix-ui/themes';

import { ROUTES } from 'constants/routes';
import { selectIsLoggedIn } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';

import AddExpenseModal from 'components/Modal/AddExpenseModal';

const FloatingBox = styled(Box)`
    bottom: var(--space-6);
    right: var(--space-4);
`;

const AddExpenseButton = () => {
    const { t } = useTranslation('group');
    const location = useLocation();
    const isLoggedIn = useAuthStore(selectIsLoggedIn);

    const isGroupJoinRoute = location.pathname.startsWith(`${ROUTES.GROUP_JOIN}/`);
    const isGroupRoute = location.pathname.startsWith(`${ROUTES.GROUP}/`) && !isGroupJoinRoute;
    const isVisibleRoute =
        location.pathname === ROUTES.DASHBOARD ||
        location.pathname === ROUTES.ACTIVITY ||
        location.pathname === ROUTES.FRIENDS ||
        isGroupRoute;

    if (!isLoggedIn || !isVisibleRoute) {
        return null;
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
