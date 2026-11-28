import { useId } from 'react';
import { PROP_COLOR } from '@chipin/tokens/theme';
import { Box, Button, Flex, Text } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import { EXPENSE_SUBMIT_BLOCKERS } from 'constants/chipin';
import { ONLINE_ONLY_ACTIONS } from 'constants/onlineOnlyActions';
import { type LedgerWriteTarget, useCanQueueLedgerWrite } from 'entities/ledger';
import {
    selectExpenseSubmitFeedback,
    selectIsDirectExpenseWithoutFriend,
} from 'store/expenseModalSelectors';
import { useExpenseModalStore } from 'store/expenseModalStore';

import { OverlayFooter } from 'components/modals/components';
import { OnlineOnly } from 'components/online-only';

import { useExpenseModalSubmit } from '../../internal/hooks';

import { ExpenseSubmitFeedbackMessage } from './internal/ExpenseSubmitFeedbackMessage';

import styles from './ExpenseButtons.module.css';

interface Props {
    onClose: () => void;
}

const CREATE: LedgerWriteTarget = { kind: 'create' };

const ExpenseButtons = ({ onClose }: Props) => {
    const { t } = useTranslation('group');
    const { mode, currency, editedEntryId, isDirectWithoutFriend } = useExpenseModalStore(
        useShallow(state => ({
            mode: state.mode,
            currency: state.currency,
            editedEntryId: state.editContext?.entryId,
            isDirectWithoutFriend: selectIsDirectExpenseWithoutFriend(state),
        })),
    );
    const canQueueOffline = useCanQueueLedgerWrite(
        mode === 'edit' && editedEntryId !== undefined
            ? { kind: 'update', entryId: editedEntryId }
            : CREATE,
    );
    const submitFeedback = useExpenseModalStore(useShallow(selectExpenseSubmitFeedback));
    // KB EXP-064: one explanation only; the amount blocker is shown below the amount field (and a
    // direct expense with no friend has none here: its empty state explains it, EXP-067).
    const feedback =
        submitFeedback?.reason === EXPENSE_SUBMIT_BLOCKERS.AMOUNT ? null : submitFeedback;
    const feedbackId = useId();
    const { isSubmitDisabled, isSubmitting, onSubmit } = useExpenseModalSubmit(onClose);

    return (
        <Flex direction="column" gap="2" minWidth="0" flexShrink="0">
            <Box px={{ initial: '4', sm: '0' }}>
                <Text
                    as="p"
                    id={feedbackId}
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                    size="2"
                    color={PROP_COLOR.neutral}
                    m="0"
                    wrap="pretty"
                >
                    {!isSubmitting && feedback && (
                        <ExpenseSubmitFeedbackMessage feedback={feedback} currency={currency} />
                    )}
                </Text>
            </Box>
            <OverlayFooter
                cancelAction={
                    <Button size="3" variant="soft" color={PROP_COLOR.neutral} onClick={onClose}>
                        {t('common:buttons.cancel')}
                    </Button>
                }
                primaryAction={
                    // KB EXP-067: the empty state's invite is the one primary action; no submit.
                    isDirectWithoutFriend ? null : (
                        // KB NET-007: offline the save is disabled with the hint (the form stays
                        // readable) unless the outbox can take it.
                        <OnlineOnly
                            action={ONLINE_ONLY_ACTIONS.expenseSave}
                            canQueueOffline={canQueueOffline}
                        >
                            <Button
                                className={styles.save}
                                size="3"
                                variant="solid"
                                disabled={isSubmitDisabled || isSubmitting}
                                loading={isSubmitting}
                                aria-describedby={
                                    !isSubmitting && feedback ? feedbackId : undefined
                                }
                                onClick={onSubmit}
                            >
                                {t(
                                    mode === 'edit'
                                        ? 'common:buttons.save'
                                        : 'common:buttons.addExpense',
                                )}
                            </Button>
                        </OnlineOnly>
                    )
                }
            />
        </Flex>
    );
};

export { ExpenseButtons };
