import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import { Flex } from '@radix-ui/themes';

import { useExpenseModalStore } from 'store/expenseModalStore';

import { BaseModal, MODAL_SIZES } from '../base-modal';
import { OverlayBody } from '../components';

import {
    ExpenseButtons,
    ExpenseDetailsSection,
    ExpenseSplitCard,
    ExpenseTargetSection,
} from './components';
import { useExpenseModalOpenChange, useExpenseModalSource } from './internal';

const AddExpenseModal = () => {
    const { t } = useTranslation('group');
    const {
        isOpened,
        openingContext,
        openingFriendId,
        setIsOpened,
        close,
        initialize,
        reset,
    } = useExpenseModalStore(
        useShallow(state => ({
            isOpened: state.isOpened,
            openingContext: state.openingContext,
            openingFriendId: state.openingFriendId,
            setIsOpened: state.setIsOpened,
            close: state.close,
            initialize: state.initialize,
            reset: state.reset,
        })),
    );
    const source = useExpenseModalSource({
        context: openingContext,
        friendId: openingFriendId,
    });

    const onReset = useCallback(() => {
        if (isOpened) {
            initialize(source);
            return;
        }

        reset();
    }, [initialize, isOpened, reset, source]);

    useExpenseModalOpenChange(isOpened, onReset);

    const content = (
        <>
            <OverlayBody>
                <Flex direction="column" gap="4">
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
            title={t('expenses.modal.title')}
            accessibleDescription={t('expenses.modal.description')}
            maxWidth={MODAL_SIZES.desktop}
            content={content}
        />
    );
};

export default AddExpenseModal;
