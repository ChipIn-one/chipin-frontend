export interface CreateGroupParams {
    groupName: string;
    groupDescription?: string;
}

export interface InviteToGroupParams {
    inviteToken: string;
}
