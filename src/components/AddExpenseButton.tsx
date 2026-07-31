import { LucideCirclePlus, LucidePlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { useShallow } from 'zustand/react/shallow';

import { Box, Button } from '@radix-ui/themes';

import { ROUTES } from 'constants/routes';
import { themeColor } from 'helpers/colors';
import { getCanAddExpense } from 'helpers/expenses';
import { selectIsLoggedIn } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';
import { selectIsSoloMode } from 'store/dashboardSelectors';
import { useDashboardStore } from 'store/dashboardStore';
import { useExpenseModalStore } from 'store/expenseModalStore';
import { useGroupsStore } from 'store/groupsStore';
import { selectDashboardLoading } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';
import { useUsersStore } from 'store/users-store';

const FloatingBox = styled(Box)`
    bottom: var(--space-6);
    right: var(--space-4);
`;

const ButtonMobile = styled(Button)<{ $isSoloMode: boolean }>`
    width: var(--space-9);
    height: var(--space-9);
    padding: 0;
    border: 6px solid
        ${({ $isSoloMode }) => themeColor($isSoloMode ? 'violet7' : 'grass7')};
`;

interface Props {
    type?: 'mobile' | 'desktop';
}

const AddExpenseButton = ({ type = 'desktop' }: Props) => {
    const { t } = useTranslation('common');
    const location = useLocation();
    const isLoggedIn = useAuthStore(selectIsLoggedIn);
    const isDashboardLoading = useLoadingStore(selectDashboardLoading);
    const isVisibleRoute = location.pathname !== ROUTES.SETTINGS;
    const { groups, selectedGroup } = useGroupsStore(
        useShallow(state => ({
            groups: state.groups,
            selectedGroup: state.selectedGroup,
        })),
    );
    const friends = useUsersStore(state => state.friends);
    const isSoloMode = useDashboardStore(selectIsSoloMode);
    const openAddExpenseModal = useExpenseModalStore(state => state.open);
    const hasAvailableGroup = groups.some(group => group.members.length > 0);
    const canAddExpense = getCanAddExpense({
        pathname: location.pathname,
        hasFriends: friends.length > 0,
        hasAvailableGroup,
        hasSelectedGroupMembers: Boolean(selectedGroup?.members.length),
    });

    if (!isLoggedIn || !isVisibleRoute) {
        return null;
    }

    if (type === 'mobile') {
        return (
            <ButtonMobile
                $isSoloMode={isSoloMode}
                size="4"
                radius="full"
                color={isSoloMode ? 'violet' : 'jade'}
                aria-label={t('buttons.addExpense')}
                loading={isDashboardLoading}
                disabled={!canAddExpense}
                onClick={() => openAddExpenseModal()}
            >
                <LucidePlus size={28} />
            </ButtonMobile>
        );
    }

    return (
        <Box display={{ initial: 'none', sm: 'block' }}>
            <FloatingBox position="fixed" right="6">
                <Button
                    size="3"
                    radius="full"
                    color={isSoloMode ? 'violet' : 'jade'}
                    loading={isDashboardLoading}
                    disabled={!canAddExpense}
                    onClick={() => openAddExpenseModal()}
                >
                    <LucideCirclePlus />
                    {t('buttons.addExpense')}
                </Button>
            </FloatingBox>
        </Box>
    );
};

export default AddExpenseButton;
