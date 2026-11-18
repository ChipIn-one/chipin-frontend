import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { type LedgerConflictNotice, useLedgerConflictNotices } from 'entities/ledger';

import { useOpenConflictDraft } from './internal/useOpenConflictDraft';

/**
 * The conflict messages of the outbox (spec 03 §2.6, D28): an edit another member changed meanwhile
 * keeps the user's changes as a draft ("Open my changes"), a delete is dropped, a draft whose
 * expense was deleted is dropped. A toast, never a dialog. Renders nothing.
 */
export const ConflictNotices = () => {
    const { t } = useTranslation('toasts');
    const openDraft = useOpenConflictDraft();
    const onNotice = useCallback(
        ({ kind, entryId, parentActivityId }: LedgerConflictNotice) => {
            switch (kind) {
                case 'changed':
                    toast.warning(t('offline.conflictChanged'), {
                        ...(parentActivityId !== null && {
                            action: {
                                label: t('offline.openMyChanges'),
                                onClick: () => {
                                    openDraft(entryId, parentActivityId);
                                },
                            },
                        }),
                    });
                    return;
                case 'notDeleted':
                    toast.warning(t('offline.conflictNotDeleted'));
                    return;
                case 'deleted':
                    toast.warning(t('offline.conflictDraftDeleted'));
            }
        },
        [openDraft, t],
    );

    useLedgerConflictNotices(onNotice);
    return null;
};
