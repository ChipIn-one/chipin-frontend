import { Amount } from 'basics';
import { LucideCheck, LucideX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import { Button, Flex, Text } from '@radix-ui/themes';

import {
    selectAllUsersSelected,
    selectSplitSummary,
    selectYourShareColor,
} from 'store/expenseModalSelectors';
import { useExpenseModalStore } from 'store/expenseModalStore';

const SplitTypeHeader = () => {
    const { t } = useTranslation('group');
    const {
        isAllSelected,
        isToggleAllHidden,
        yourShareAmount,
        yourShareTone,
        currency,
        toggleAllParticipants,
    } = useExpenseModalStore(
        useShallow(state => ({
            isAllSelected: selectAllUsersSelected(state),
            isToggleAllHidden: state.targetMode !== 'group',
            yourShareAmount: selectSplitSummary(state).yourShareAmount,
            yourShareTone: selectYourShareColor(state),
            currency: state.currency,
            toggleAllParticipants: state.toggleAllParticipants,
        })),
    );

    const label = isAllSelected
        ? t('expenses.modal.split.deselectAll')
        : t('expenses.modal.split.selectAll');
    const yourShareTitle = `${t('expenses.modal.split.yourShare')}:`;
    const Icon = isAllSelected ? LucideX : LucideCheck;

    return (
        <Flex justify="between" align="center" gap="3">
            {isToggleAllHidden ? (
                <span />
            ) : (
                <Button
                    type="button"
                    size="2"
                    variant="soft"
                    color="gray"
                    onClick={toggleAllParticipants}
                >
                    <Icon size={14} />
                    {label}
                </Button>
            )}
            <Flex align="center" gap="1">
                <Text size="2" color="gray">
                    {yourShareTitle}
                </Text>
                <Text size="2" weight="bold" color={yourShareTone}>
                    <Amount value={yourShareAmount} tokenCode={currency} />
                </Text>
            </Flex>
        </Flex>
    );
};

export default SplitTypeHeader;
