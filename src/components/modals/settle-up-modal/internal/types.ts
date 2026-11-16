import type { GroupUser } from 'api/chipin.types';
import type { Balance } from 'entities/balance';

import type { FriendSettleUpProps } from '../types';

export interface DebtOption {
    user: GroupUser;
    balance: Balance;
    balances: readonly Balance[];
}

export type SettlementFormProps = Omit<FriendSettleUpProps, 'source'>;
