import type { Group } from 'api/chipin.types';
import { MIN_GROUP_EXPENSE_PARTICIPANTS } from 'constants/chipin';

const isGroupExpenseTarget = (
    group: Group | null | undefined,
): group is Group =>
    Boolean(
        group &&
            group.members.length >= MIN_GROUP_EXPENSE_PARTICIPANTS,
    );

const hasGroupExpenseTarget = (groups: Group[]): boolean =>
    groups.some(isGroupExpenseTarget);

export { hasGroupExpenseTarget, isGroupExpenseTarget };
