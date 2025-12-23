export interface ApiGroup {
    id: string;
    name: string;
    description: string | null;
    emoji: string | null;
    coverUrl: string | null;
    createdAt: number;
    updatedAt: number;
    // TODO TO BASE API USER
    inviteToken?: string;
    creator?: ApiUser;
    members: ApiUser[];
}

export interface ApiUser {
    id: string;
    email: string;
    displayName: string;
    firstName: string | null;
    lastName: string | null;
    picture: string | null;
    createdAt: number;
    updatedAt: number;
}

export interface CreateGroupParams {
    groupName: string;
    groupDescription?: string;
    emoji?: string;
}

export interface RemoveGroupParams {
    groupId: string;
}

export interface InviteToGroupParams {
    inviteToken: string;
}

export interface DashboardApiResponse {
    groups: ApiGroup[];
}

export interface JoinGroupResponse {
    groupId: ApiGroup['id'];
    groupName: ApiGroup['name'];
}
