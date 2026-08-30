import { type MouseEvent, useCallback } from 'react';
import { LucideInfo } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';

import { Callout, Flex, Link } from '@radix-ui/themes';

import { ROUTES } from 'constants/routes';
import { APP_MODES, useDashboardStore } from 'store/dashboardStore';
import { selectIsSingleMemberGroup } from 'store/expenseModalSelectors';
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
    const navigate = useNavigate();
    const setAppMode = useDashboardStore(state => state.setAppMode);
    const {
        isOpened,
        openingContext,
        openingFriendId,
        mode,
        setIsOpened,
        close,
        initialize,
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
            reset: state.reset,
        })),
    );
    const source = useExpenseModalSource({
        context: openingContext,
        friendId: openingFriendId,
    });
    const isSingleMemberGroup = useExpenseModalStore(selectIsSingleMemberGroup);

    const onReset = useCallback(() => {
        if (isOpened) {
            if (mode === 'create') {
                initialize(source);
            }
            return;
        }

        reset();
    }, [initialize, isOpened, mode, reset, source]);

    const onSoloModeClick = useCallback(
        (event: MouseEvent<HTMLAnchorElement>) => {
            event.preventDefault();
            setAppMode(APP_MODES.SOLO);
            close();
            navigate(ROUTES.SOLO);
        },
        [close, navigate, setAppMode],
    );

    useExpenseModalOpenChange(isOpened, onReset);

    const content = (
        <>
            <OverlayBody>
                <Flex direction="column" gap="4">
                    {mode === 'create' && isSingleMemberGroup && (
                        <Callout.Root color="blue" size="2" role="status">
                            <Callout.Icon>
                                <LucideInfo />
                            </Callout.Icon>
                            <Callout.Text>
                                <Trans
                                    t={t}
                                    i18nKey="expenses.modal.singleMemberNotice"
                                    components={{
                                        soloMode: (
                                            <Link href={ROUTES.SOLO} onClick={onSoloModeClick} />
                                        ),
                                    }}
                                />
                            </Callout.Text>
                        </Callout.Root>
                    )}
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
                mode === 'edit'
                    ? 'expenses.modal.descriptionEdit'
                    : 'expenses.modal.description',
            )}
            maxWidth={MODAL_SIZES.desktop}
            content={content}
        />
    );
};

export default AddExpenseModal;
