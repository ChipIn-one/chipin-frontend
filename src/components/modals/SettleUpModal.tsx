import { useMemo, useRef, useState } from 'react';
import { AmountInput, UserAvatar } from 'basics';
import { LucideArrowRight, LucideChevronDown, LucideInfo } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import styled from 'styled-components';
import { useShallow } from 'zustand/react/shallow';

import { Button, Flex, Text } from '@radix-ui/themes';

import type { User } from 'api/chipin.types';
import { themeColor } from 'helpers/colors';
import { useActivityStore } from 'store/activityStore';
import { selectSettlementAdding } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';
import { useUsersStore } from 'store/usersStore';

import CurrencySelect from 'components/CurrencySelect';

import BaseModal from './BaseModal';

export interface SettlementCurrencyBalance {
    currency: string;
    amount: number;
}

interface Props {
    isOpened: boolean;
    setIsOpened: (isOpen: boolean) => void;
    friend: User;
    balances: SettlementCurrencyBalance[];
    initialCurrency: string;
}

const ModalSurface = styled.div`
    display: flex;
    min-height: 100%;
    flex-direction: column;
    gap: var(--space-4);
`;

const ActionFooter = styled.div`
    display: flex;
    margin-top: auto;
    padding-top: var(--space-2);
    padding-bottom: env(safe-area-inset-bottom);

    & > button {
        width: 100%;
    }
`;

const PersonColumn = styled.div`
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
`;

const DirectionLabel = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    color: ${themeColor('jade9')};
`;

const AmountPanel = styled.div`
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-4);
    border: 1px solid ${themeColor('jade6')};
    border-radius: var(--radius-4);
    background-color: ${themeColor('jade1')};
`;

const LargeAmountInput = styled(AmountInput)`
    height: 72px;
    align-items: center;
    box-shadow: none;

    & input {
        height: 100%;
        padding: 0 var(--space-3);
        text-align: center;
        font-size: var(--font-size-8);
        font-weight: 700;
        line-height: 1;
    }
`;

const Notice = styled.div`
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border: 1px solid ${themeColor('jade6')};
    border-radius: var(--radius-4);
    background-color: ${themeColor('jade2')};
    color: ${themeColor('gray11')};
`;

const getFirstName = (user: User) => user.firstName || user.displayName.split(' ')[0];

const formatDebtAmount = (amount: number) => Math.abs(amount).toFixed(2);

const SettleUpModal = ({ isOpened, setIsOpened, friend, balances, initialCurrency }: Props) => {
    const { t } = useTranslation(['common', 'friends', 'toasts']);
    const amountWidthContainerRef = useRef<HTMLDivElement | null>(null);
    const { user, fetchSetFriends } = useUsersStore(
        useShallow(state => ({ user: state.user, fetchSetFriends: state.fetchSetFriends })),
    );
    const createSettlement = useActivityStore(state => state.createSettlement);
    const isSubmitting = useLoadingStore(selectSettlementAdding);

    const currencies = useMemo(() => balances.map(balance => balance.currency), [balances]);
    const initialSelectedCurrency = currencies.includes(initialCurrency)
        ? initialCurrency
        : (currencies[0] ?? initialCurrency);
    const [currency, setCurrency] = useState(initialSelectedCurrency);
    const selectedBalance =
        balances.find(balance => balance.currency === currency) ?? balances[0] ?? null;
    const [amount, setAmount] = useState(formatDebtAmount(selectedBalance?.amount ?? 0));

    const handleCurrencyChange = (nextCurrency: string) => {
        const nextBalance = balances.find(balance => balance.currency === nextCurrency);

        setCurrency(nextCurrency);
        setAmount(formatDebtAmount(nextBalance?.amount ?? 0));
    };

    const isFriendPayingUser = Boolean(selectedBalance && selectedBalance.amount > 0);
    const payer = isFriendPayingUser ? friend : user;
    const recipient = isFriendPayingUser ? user : friend;
    const payerName = isFriendPayingUser ? getFirstName(friend) : t('friends:settleUp.you');
    const recipientName = isFriendPayingUser ? t('friends:settleUp.you') : getFirstName(friend);
    const recipientDisplayName = recipient?.displayName ?? '';
    const numericAmount = Number(amount);
    const maxAmount = Math.abs(selectedBalance?.amount ?? 0);
    const isAmountValid = numericAmount > 0 && maxAmount > 0 && numericAmount <= maxAmount + 0.001;
    const fromUserId = isFriendPayingUser ? friend.id : user?.id;
    const toUserId = isFriendPayingUser ? user?.id : friend.id;
    const isSubmitDisabled = !fromUserId || !toUserId || !selectedBalance || !isAmountValid;

    const handleSubmit = () => {
        if (!fromUserId || !toUserId || !selectedBalance || !isAmountValid) {
            return;
        }

        createSettlement({
            fromUserId,
            toUserId,
            amount: numericAmount,
            currency,
        })
            .then(() => {
                toast.success(t('toasts:settlement.created'));
                fetchSetFriends();
                setIsOpened(false);
            })
            .catch(error => {
                console.error('Error creating settlement:', error);
            });
    };

    return (
        <BaseModal
            isOpened={isOpened}
            setIsOpened={setIsOpened}
            title={t('friends:settleUp.recordPayment')}
            maxWidth="460px"
            content={
                <ModalSurface>
                    <Flex align="center" justify="between" gap="3">
                        <PersonColumn>
                            <UserAvatar size="4" user={payer ?? undefined} />
                            <Text align="center" weight="bold" truncate>
                                {payerName}
                            </Text>
                        </PersonColumn>

                        <DirectionLabel>
                            <LucideArrowRight size={32} />
                            <Text size="2" weight="bold">
                                {t('friends:settleUp.paid')}
                            </Text>
                        </DirectionLabel>

                        <PersonColumn>
                            <UserAvatar size="4" user={recipient ?? undefined} />
                            <Text align="center" weight="bold" truncate>
                                {recipientName}
                            </Text>
                        </PersonColumn>
                    </Flex>

                    <AmountPanel ref={amountWidthContainerRef}>
                        <Flex justify="between" align="center" gap="3">
                            <Text as="label" size="3" weight="bold" color="gray">
                                {t('common:fields.amount')}
                            </Text>

                            {currencies.length > 1 ? (
                                <CurrencySelect
                                    currency={currency}
                                    currencies={currencies}
                                    onChange={handleCurrencyChange}
                                    contentWidthMode="parent"
                                    triggerElement={
                                        <Button type="button" variant="surface" size="3">
                                            {currency}
                                            <LucideChevronDown size={16} />
                                        </Button>
                                    }
                                    widthContainerRef={amountWidthContainerRef}
                                />
                            ) : (
                                <Text size="5" weight="bold">
                                    {currency}
                                </Text>
                            )}
                        </Flex>

                        <LargeAmountInput
                            value={amount}
                            onChange={setAmount}
                            color="jade"
                            size="3"
                            autoFocus
                        />
                    </AmountPanel>

                    <Flex justify="between" gap="4">
                        <Text size="2" weight="bold" color="gray">
                            {t('friends:settleUp.recipient')}
                        </Text>
                        <Text size="2" weight="bold" align="right">
                            {recipientDisplayName}
                        </Text>
                    </Flex>

                    <Notice>
                        <LucideInfo size={18} />
                        <Text size="2" weight="medium">
                            {t('friends:settleUp.noMoneyMoves')}
                        </Text>
                    </Notice>

                    <ActionFooter>
                        <Button
                            type="button"
                            size="4"
                            color="jade"
                            disabled={isSubmitDisabled}
                            loading={isSubmitting}
                            onClick={handleSubmit}
                        >
                            {t('friends:settleUp.recordPayment')}
                        </Button>
                    </ActionFooter>
                </ModalSurface>
            }
        />
    );
};

export default SettleUpModal;
