import { LucideCirclePlus, LucidePlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { useShallow } from 'zustand/react/shallow';

import { Box, Button } from '@radix-ui/themes';

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
import { selectCanAccessSolo, useUsersStore } from 'store/users-store';

const ButtonMobile = styled(Button)<{ $isSoloMode: boolean }>`
    width: var(--space-9);
    height: var(--space-9);
    padding: 0;
    border: 6px solid ${({ $isSoloMode }) => themeColor($isSoloMode ? 'violet7' : 'grass7')};
`;

interface Props {
    type?: 'mobile' | 'desktop' | 'sidebar';
}

const AddExpenseButton = ({ type = 'desktop' }: Props) => {
    const { t } = useTranslation('common');
    const location = useLocation();
    const isLoggedIn = useAuthStore(selectIsLoggedIn);
    const isDashboardLoading = useLoadingStore(selectDashboardLoading);
    const { groups, selectedGroup } = useGroupsStore(
        useShallow(state => ({
            groups: state.groups,
            selectedGroup: state.selectedGroup,
        })),
    );
    const friends = useUsersStore(state => state.friends);
    const canAccessSolo = useUsersStore(selectCanAccessSolo);
    const isSoloModeFromStore = useDashboardStore(selectIsSoloMode);
    const isSoloMode = canAccessSolo && isSoloModeFromStore;
    const openAddExpenseModal = useExpenseModalStore(state => state.open);
    const hasAvailableGroup = groups.some(group => group.members.length > 0);
    const canAddExpense = getCanAddExpense({
        pathname: location.pathname,
        hasFriends: friends.length > 0,
        hasAvailableGroup,
        hasSelectedGroupMembers: Boolean(selectedGroup?.members.length),
    });

    if (!isLoggedIn) {
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

    const button = (
        <Button
            size="3"
            radius="large"
            color={isSoloMode ? 'violet' : 'jade'}
            loading={isDashboardLoading}
            disabled={!canAddExpense}
            onClick={() => openAddExpenseModal()}
        >
            <LucideCirclePlus />
            {t('buttons.addExpense')}
        </Button>
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
