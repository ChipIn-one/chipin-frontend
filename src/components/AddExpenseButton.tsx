import { type ReactElement, useState } from 'react';
import { LucideCirclePlus, LucidePlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { useShallow } from 'zustand/react/shallow';

import { Box, Button, Tooltip } from '@radix-ui/themes';

import { themeColor } from 'helpers/colors';
import { getAddExpenseAvailability } from 'helpers/expenses';
import { selectIsLoggedIn } from 'store/authSelectors';
import { useAuthStore } from 'store/authStore';
import { selectIsSoloMode } from 'store/dashboardSelectors';
import { useDashboardStore } from 'store/dashboardStore';
import { useExpenseModalStore } from 'store/expenseModalStore';
import { useGroupsStore } from 'store/groupsStore';
import { selectDashboardLoading } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';
import { selectCanAccessSolo, useUsersStore } from 'store/users-store';

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
    const { canAddExpense, unavailableReason } = getAddExpenseAvailability({
        pathname: location.pathname,
        friendCount: friends.length,
        groupMemberCounts: groups.map(group => group.members.length),
        selectedGroupMemberCount: selectedGroup?.members.length ?? 0,
    });
    const isUnavailable = !isDashboardLoading && !canAddExpense;
    const unavailableMessage = unavailableReason
        ? t(`addExpenseUnavailable.${unavailableReason}`)
        : null;

    if (!isLoggedIn) {
        return null;
    }

    const onAddExpenseClick = () => {
        if (isUnavailable) {
            setIsUnavailableTooltipOpen(true);
            return;
        }

        openAddExpenseModal();
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
                loading={isDashboardLoading}
                onClick={onAddExpenseClick}
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
            loading={isDashboardLoading}
            onClick={onAddExpenseClick}
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
