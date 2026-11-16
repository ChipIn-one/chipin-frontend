// Any group shape with members (the domain group of `entities/groups`, a test fixture).
interface GroupWithMembers {
    readonly members: readonly unknown[];
}

const isGroupExpenseTarget = <G extends GroupWithMembers>(
    group: G | null | undefined,
): group is G => Boolean(group && group.members.length >= 2);

const hasGroupExpenseTarget = (groups: readonly GroupWithMembers[]): boolean =>
    groups.some(isGroupExpenseTarget);

export { hasGroupExpenseTarget, isGroupExpenseTarget };
