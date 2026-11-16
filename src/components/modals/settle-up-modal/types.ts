import type { FriendUser, UserSummary } from 'api/chipin.types';
import type { Balance } from 'entities/balance';
import type { Group } from 'entities/groups';
import type { SettlementDraft } from 'entities/ledger';

export type SettlementUser = Pick<UserSummary, 'id' | 'displayName' | 'picture'>;

export interface FriendSettleUpProps {
    source: 'friend';
    isOpened: boolean;
    onOpenChange: (isOpen: boolean) => void;
    friend: FriendUser;
    /** The exact balances with the friend, one per currency (`net < 0`: you owe). */
    balances: readonly Balance[];
    initialCurrency: string;
    onSubmit: (settlement: SettlementDraft) => Promise<void>;
}

export interface GroupSettleUpProps {
    source: 'group';
    group: Group;
    memberId?: string;
}

export type SettleUpModalProps = FriendSettleUpProps | GroupSettleUpProps;
