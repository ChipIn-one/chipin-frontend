import type {
    CreateSettlementParams,
    FriendBalance,
    FriendUser,
    Group,
    UserSummary,
} from 'api/chipin.types';

export type SettlementUser = Pick<UserSummary, 'id' | 'displayName' | 'picture'>;

export interface FriendSettleUpProps {
    source: 'friend';
    isOpened: boolean;
    onOpenChange: (isOpen: boolean) => void;
    friend: FriendUser;
    balances: FriendBalance[];
    initialCurrency: string;
    onSubmit: (params: CreateSettlementParams) => Promise<void>;
}

export interface GroupSettleUpProps {
    source: 'group';
    group: Group;
    memberId?: string;
}

export type SettleUpModalProps = FriendSettleUpProps | GroupSettleUpProps;
