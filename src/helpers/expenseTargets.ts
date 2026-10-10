import type { Group } from 'api/chipin.types';

const isGroupExpenseTarget = (
    group: Group | null | undefined,
): group is Group => Boolean(group && group.members.length >= 2);

const hasGroupExpenseTarget = (groups: Group[]): boolean =>
    groups.some(isGroupExpenseTarget);

export { hasGroupExpenseTarget, isGroupExpenseTarget };
