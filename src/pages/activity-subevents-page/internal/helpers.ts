import type { AppEvent } from 'api/activity.types';
import { ACTIVITY_ACTIONS } from 'constants/activity';

const hasLedgerEntryReversedEvent = (
    events: Pick<AppEvent, 'action'>[],
): boolean => {
    for (const event of events) {
        if (
            event.action === ACTIVITY_ACTIONS.EXPENSE_REVERSED ||
            event.action === ACTIVITY_ACTIONS.SETTLEMENT_REVERSED
        ) {
            return true;
        }
    }

    return false;
};

export { hasLedgerEntryReversedEvent };
