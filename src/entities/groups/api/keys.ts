// The keys of the groups entity (spec 03 §1.3): `invalidateQueries({ queryKey: groupsKeys.all })`
// invalidates every group query.
export const groupsKeys = {
    all: ['groups'] as const,
    list: () => [...groupsKeys.all, 'list'] as const,
    detail: (groupId: string) => [...groupsKeys.all, 'detail', groupId] as const,
    activity: (groupId: string) => [...groupsKeys.all, 'activity', groupId] as const,
};
