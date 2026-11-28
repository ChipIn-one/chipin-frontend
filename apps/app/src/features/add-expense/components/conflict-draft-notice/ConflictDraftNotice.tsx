import { useState } from 'react';
import { PROP_COLOR } from '@chipin/tokens/theme';
import { Button, Callout, Flex } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';

import { discardConflictDraft, useOutboxOverlay } from 'entities/ledger';
import { useConflictDraftStore } from 'store/conflictDraftStore';
import { useExpenseModalStore } from 'store/expenseModalStore';

/**
 * Spec 03 §2.6 (03-16b): the edit form opened on a conflict draft marks the user's unsaved changes
 * and offers "Discard my changes" (no request; the form closes, the expense stays as it is now).
 * Nothing renders otherwise; with offline writes off the overlay is empty, so never.
 */
export const ConflictDraftNotice = () => {
    const { t } = useTranslation(['common', 'toasts']);
    const { conflictDraftEntryIds } = useOutboxOverlay();
    const openedEntryId = useConflictDraftStore(state => state.openedEntryId);
    const { mode, entryId, close } = useExpenseModalStore(
        useShallow(state => ({
            mode: state.mode,
            entryId: state.editContext?.entryId,
            close: state.close,
        })),
    );
    const [isDiscarding, setIsDiscarding] = useState(false);

    if (
        mode !== 'edit' ||
        entryId === undefined ||
        openedEntryId !== entryId ||
        !conflictDraftEntryIds.has(entryId)
    ) {
        return null;
    }

    const onDiscard = (): void => {
        setIsDiscarding(true);
        discardConflictDraft(entryId)
            .then(
                () => {
                    useConflictDraftStore.getState().setOpened(null);
                    close();
                },
                () => {
                    toast.error(t('toasts:offline.actionFailed'));
                },
            )
            .finally(() => {
                setIsDiscarding(false);
            });
    };

    return (
        <Callout.Root color={PROP_COLOR.warning} size="1" role="status">
            <Flex direction="column" gap="2">
                <Callout.Text>{t('outbox.conflictDraftMarker')}</Callout.Text>
                <Flex justify="end">
                    <Button
                        type="button"
                        size="1"
                        variant="soft"
                        color={PROP_COLOR.danger}
                        loading={isDiscarding}
                        disabled={isDiscarding}
                        onClick={onDiscard}
                    >
                        {t('outbox.discardDraft')}
                    </Button>
                </Flex>
            </Flex>
        </Callout.Root>
    );
};
