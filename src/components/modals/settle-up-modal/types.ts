import type {
    CreateSettlementParams,
    FriendBalance,
    FriendUser,
    Group,
} from 'api/chipin.types';

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
