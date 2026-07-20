import type { FriendBalance, GroupUser } from 'api/chipin.types';

import type { FriendSettleUpProps } from '../types';

export interface DebtOption {
    user: GroupUser;
    balance: FriendBalance;
    balances: FriendBalance[];
}

export interface SettlementFormProps extends Omit<FriendSettleUpProps, 'source'> {
    onBack?: () => void;
}
