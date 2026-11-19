import { useCallback, useEffect } from 'react';
import { Flex } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import { useExpenseModalStore } from 'store/expenseModalStore';

import { BaseModal, MODAL_SIZES } from 'components/modals/base-modal';
import { OverlayBody } from 'components/modals/components';

import { ConflictDraftNotice } from './components/conflict-draft-notice/ConflictDraftNotice';
import ExpenseButtons from './components/expense-buttons/ExpenseButtons';
import ExpenseDetailsSection from './components/expense-details-section/ExpenseDetailsSection';
import ExpenseSplitCard from './components/expense-split-card/ExpenseSplitCard';
import ExpenseTargetSection from './components/expense-target-section/ExpenseTargetSection';
import { useExpenseModalOpenChange, useExpenseModalSource } from './internal/hooks';

const AddExpenseModal = () => {
    const { t } = useTranslation('group');
    const {
        isOpened,
        openingContext,
        openingFriendId,
        mode,
        setIsOpened,
        close,
        initialize,
        applyLateGroups,
        reset,
    } = useExpenseModalStore(
        useShallow(state => ({
            isOpened: state.isOpened,
            openingContext: state.openingContext,
            openingFriendId: state.openingFriendId,
            mode: state.mode,
            setIsOpened: state.setIsOpened,
            close: state.close,
            initialize: state.initialize,
            applyLateGroups: state.applyLateGroups,
            reset: state.reset,
        })),
    );
    const source = useExpenseModalSource({
        context: openingContext,
        friendId: openingFriendId,
    });
    const onReset = useCallback(() => {
        if (isOpened) {
            if (mode === 'create') {
                initialize(source);
            }
            return;
        }

        reset();
    }, [initialize, isOpened, mode, reset, source]);

    useExpenseModalOpenChange(isOpened, onReset);

    // The groups list can load after the modal opened (#718): the store takes it and picks the
    // default group unless a target is already set.
    useEffect(() => {
        applyLateGroups(source);
    }, [applyLateGroups, source]);

    const content = (
        <>
            <OverlayBody>
                <Flex direction="column" gap="4">
                    <ConflictDraftNotice />
                    <ExpenseDetailsSection />
                    <ExpenseTargetSection />
                    <ExpenseSplitCard />
                </Flex>
            </OverlayBody>
            <ExpenseButtons onClose={close} />
        </>
    );

    return (
        <BaseModal
            isOpened={isOpened}
            setIsOpened={setIsOpened}
            title={t(mode === 'edit' ? 'expenses.modal.titleEdit' : 'expenses.modal.title')}
            accessibleDescription={t(
                mode === 'edit' ? 'expenses.modal.descriptionEdit' : 'expenses.modal.description',
            )}
            maxWidth={MODAL_SIZES.desktop}
            content={content}
        />
    );
};

export { AddExpenseModal };
