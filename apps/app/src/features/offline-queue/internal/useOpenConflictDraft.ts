import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from 'constants/routes';
import { useConflictDraftStore } from 'store/conflictDraftStore';
import { useOutboxSheetStore } from 'store/outboxSheetStore';

/**
 * "Open my changes" (spec 03 §2.6, 03-16b): the expense history of the entry opens its edit form on
 * the conflict draft (its Edit reads the request). `OutboxSheet` closes first.
 */
export const useOpenConflictDraft = (): ((entryId: string, parentActivityId: string) => void) => {
    const navigate = useNavigate();

    return useCallback(
        (entryId, parentActivityId) => {
            useOutboxSheetStore.getState().setIsOpen(false);
            useConflictDraftStore.getState().requestOpen(entryId);
            void navigate(`${ROUTES.ACTIVITY}/${encodeURIComponent(parentActivityId)}`);
        },
        [navigate],
    );
};
