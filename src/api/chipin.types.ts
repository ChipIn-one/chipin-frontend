export interface CreateGroupParams {
    groupName: string;
    groupDescription?: string;
}

export interface RemoveGroupParams {
    groupId: string;
}

export interface InviteToGroupParams {
    inviteToken: string;
}
