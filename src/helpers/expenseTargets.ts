import type { Group } from 'api/chipin.types';

const isGroupExpenseTarget = (
    group: Group | null | undefined,
): group is Group => Boolean(group);

const hasGroupExpenseTarget = (groups: Group[]): boolean =>
    groups.some(isGroupExpenseTarget);

export { hasGroupExpenseTarget, isGroupExpenseTarget };
