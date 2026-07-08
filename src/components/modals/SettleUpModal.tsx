import { useState } from 'react';
import { AmountInput, UserAvatar } from 'basics';
import { LucideArrowRight, LucideInfo } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import styled from 'styled-components';

import { Button, Callout, Card, Flex, Text } from '@radix-ui/themes';

import type { CreateSettlementParams, FriendBalance, FriendUser } from 'api/chipin.types';
import { useActivityStore } from 'store/activityStore';
import { selectSettlementAdding } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';
import { selectUserPreferredName } from 'store/usersSelectors';
import { useUsersStore } from 'store/usersStore';

import Select, { SelectItem } from 'components/Select';

import BaseModal from './BaseModal';
import { MODAL_SIZES } from './constants';

interface Props {
    isOpened: boolean;
    setIsOpened: (isOpen: boolean) => void;
    friend: FriendUser;
    balances: FriendBalance[];
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
    gap: var(--space-3);
    margin-top: auto;
    padding-top: var(--space-2);
    padding-bottom: env(safe-area-inset-bottom);

    & > button:first-child {
        flex: 1;
    }

    & > button:last-child {
        flex: 2;
    }
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

const getAmountValue = (balance: FriendBalance) => String(Math.abs(balance.netAmount));

const SettleUpModal = ({ isOpened, setIsOpened, friend, balances, initialCurrency }: Props) => {
    const { t } = useTranslation(['common', 'friends', 'toasts']);
    const user = useUsersStore(state => state.user);
    const createSettlement = useActivityStore(state => state.createSettlement);
    const isSubmitting = useLoadingStore(selectSettlementAdding);

    const [currency, setCurrency] = useState(initialCurrency);

    const selectedBalance = balances.find(balance => balance.currency === currency) ?? balances[0];
    const [amount, setAmount] = useState(() => getAmountValue(selectedBalance));
    const currencyItems: SelectItem[] = balances.map(balance => ({
        value: balance.currency,
        label: balance.currency,
    }));

    const handleCurrencyChange = (nextCurrency: string) => {
        const nextBalance =
            balances.find(balance => balance.currency === nextCurrency) ?? selectedBalance;

        setCurrency(nextCurrency);
        setAmount(getAmountValue(nextBalance));
    };

    if (!user) {
        return null;
    }

    const isFriendPayer = selectedBalance.netAmount > 0;
    const settlementParams = {
        fromUserId: isFriendPayer ? friend.id : user.id,
        toUserId: isFriendPayer ? user.id : friend.id,
        amount: Number(amount),
        currency,
    } satisfies CreateSettlementParams;
    const isSubmitDisabled = settlementParams.amount <= 0;
    const payer = isFriendPayer ? friend : user;
    const recipient = isFriendPayer ? user : friend;
    const payerName = isFriendPayer ? selectUserPreferredName(friend) : t('friends:settleUp.you');
    const recipientName = isFriendPayer
        ? t('friends:settleUp.you')
        : selectUserPreferredName(friend);

    const handleSubmit = () => {
        createSettlement(settlementParams)
            .then(() => {
                toast.success(t('toasts:settlement.created'));
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
            maxWidth={MODAL_SIZES.default}
            content={
                <ModalSurface>
                    <Flex align="center" justify="between" gap="3">
                        <Flex flexGrow="1" minWidth="0" direction="column" align="center" gap="2">
                            <UserAvatar size="4" user={payer ?? undefined} />
                            <Text align="center" weight="bold" truncate>
                                {payerName}
                            </Text>
                        </Flex>

                        <Flex direction="column" align="center" gap="1" flexShrink="0">
                            <Text as="span" color="jade">
                                <LucideArrowRight size={32} />
                            </Text>
                            <Text size="2" weight="bold" color="jade">
                                {t('friends:settleUp.paid')}
                            </Text>
                        </Flex>

                        <Flex flexGrow="1" minWidth="0" direction="column" align="center" gap="2">
                            <UserAvatar size="4" user={recipient ?? undefined} />
                            <Text align="center" weight="bold" truncate>
                                {recipientName}
                            </Text>
                        </Flex>
                    </Flex>

                    <Card>
                        <Flex direction="column" gap="4">
                            <Flex justify="between" align="center" gap="3">
                                <Text as="label" size="3" weight="bold" color="gray">
                                    {t('common:fields.amount')}
                                </Text>

                                {currencyItems.length > 1 ? (
                                    <Select
                                        items={currencyItems}
                                        value={currency}
                                        onChange={handleCurrencyChange}
                                        size="3"
                                        triggerVariant="surface"
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
                        </Flex>
                    </Card>

                    <Flex justify="between" gap="4">
                        <Text size="2" weight="bold" color="gray">
                            {t('friends:settleUp.recipient')}
                        </Text>
                        <Text size="2" weight="bold" align="right">
                            {recipient.displayName}
                        </Text>
                    </Flex>

                    <Callout.Root color="jade" size="2">
                        <Callout.Icon>
                            <LucideInfo size={18} />
                        </Callout.Icon>
                        <Callout.Text>{t('friends:settleUp.noMoneyMoves')}</Callout.Text>
                    </Callout.Root>

                    <ActionFooter>
                        <Button
                            type="button"
                            size="4"
                            variant="soft"
                            color="gray"
                            onClick={() => setIsOpened(false)}
                        >
                            {t('common:buttons.cancel')}
                        </Button>

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
