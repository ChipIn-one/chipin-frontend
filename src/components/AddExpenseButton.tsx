import { LucideCirclePlus, LucidePlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import styled from 'styled-components';

import { Box, Button } from '@radix-ui/themes';

import { ROUTES } from 'constants/routes';
import { selectIsLoggedIn } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';

import AddExpenseModal from 'components/Modal/AddExpenseModal';

const FloatingBox = styled(Box)`
    bottom: calc(env(safe-area-inset-bottom) + 4rem);

    @media (min-width: 768px) {
        bottom: var(--space-6);
    }
`;

const MobileFab = styled(Button)`
    width: 3rem;
    height: 3rem;
    padding: 0;
`;

const AddExpenseButton = () => {
    const { t } = useTranslation();
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
        <AddExpenseModal>
            <FloatingBox position="fixed" right={{ initial: '4', sm: '6' }}>
                <Box display={{ initial: 'none', sm: 'block' }}>
                    <Button size="3" radius="full" color="jade">
                        <LucideCirclePlus />
                        {t('expenses.modal.submit')}
                    </Button>
                </Box>

                <Box display={{ initial: 'block', sm: 'none' }}>
                    <MobileFab
                        size="3"
                        radius="full"
                        color="jade"
                        aria-label={t('expenses.modal.submit')}
                    >
                        <LucidePlus size={24} />
                    </MobileFab>
                </Box>
            </FloatingBox>
        </AddExpenseModal>
    );
};

export default AddExpenseButton;
