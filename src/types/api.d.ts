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

export interface ApiGroup {
    id: string;
    name: string;
    inviteToken: string;
    description: string | null;
    creator: ApiUser;
    members: ApiUser[];
    createdAt: number;
    updatedAt: number;
    emoji: string | null;
    groupImg: string;
}
