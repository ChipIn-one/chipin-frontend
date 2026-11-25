import { useId } from 'react';
import { Box, Button, Flex, Text } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import { ONLINE_ONLY_ACTIONS } from 'constants/onlineOnlyActions';
import { type LedgerWriteTarget, useCanQueueLedgerWrite } from 'entities/ledger';
import { selectExpenseSubmitFeedback } from 'store/expenseModalSelectors';
import { useExpenseModalStore } from 'store/expenseModalStore';

import { OverlayFooter } from 'components/modals/components';
import { OnlineOnly } from 'components/online-only';

import { useExpenseModalSubmit } from '../../internal/hooks';

import { ExpenseSubmitFeedbackMessage } from './internal/ExpenseSubmitFeedbackMessage';

interface Props {
    onClose: () => void;
}

const CREATE: LedgerWriteTarget = { kind: 'create' };

const ExpenseButtons = ({ onClose }: Props) => {
    const { t } = useTranslation('group');
    const { mode, currency, editedEntryId } = useExpenseModalStore(
        useShallow(state => ({
            mode: state.mode,
            currency: state.currency,
            editedEntryId: state.editContext?.entryId,
        })),
    );
    const canQueueOffline = useCanQueueLedgerWrite(
        mode === 'edit' && editedEntryId !== undefined
            ? { kind: 'update', entryId: editedEntryId }
            : CREATE,
    );
    const feedback = useExpenseModalStore(useShallow(selectExpenseSubmitFeedback));
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
                    color="gray"
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
                    <Button size="3" variant="soft" color="gray" onClick={onClose}>
                        {t('common:buttons.cancel')}
                    </Button>
                }
                primaryAction={
                    // KB NET-007: offline the save is disabled with the hint (the form stays
                    // readable) unless the outbox can take it.
                    <OnlineOnly
                        action={ONLINE_ONLY_ACTIONS.expenseSave}
                        canQueueOffline={canQueueOffline}
                    >
                        <Button
                            size="3"
                            variant="solid"
                            disabled={isSubmitDisabled || isSubmitting}
                            loading={isSubmitting}
                            aria-describedby={!isSubmitting && feedback ? feedbackId : undefined}
                            onClick={onSubmit}
                        >
                            {t(
                                mode === 'edit'
                                    ? 'common:buttons.save'
                                    : 'common:buttons.addExpense',
                            )}
                        </Button>
                    </OnlineOnly>
                }
            />
        </Flex>
    );
};

export { ExpenseButtons };
