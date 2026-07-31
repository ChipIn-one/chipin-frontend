import { useId, useState } from 'react';
import { LucideArrowLeft, LucideInfo } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { Button, Callout, Flex } from '@radix-ui/themes';

import { selectSettlementAdding } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';
import { useUsersStore } from 'store/users-store';

import type { SelectItem } from 'components/Select';

import { BaseModal, MODAL_SIZES } from '../../base-modal';
import {
    getSettlementAmount,
    getSettlementViewModel,
    selectSettlementBalance,
    type SettlementFormProps,
} from '../internal';
import { ActionFooter, ModalSurface } from '../styled';

import SettlementAmountField from './SettlementAmountField';
import SettlementDebtSummary from './SettlementDebtSummary';
import SettlementStatus from './SettlementStatus';

const SettlementForm = ({
    isOpened,
    onOpenChange,
    friend,
    balances,
    initialCurrency,
    onSubmit,
    onBack,
}: SettlementFormProps) => {
    const { t } = useTranslation(['common', 'friends', 'toasts']);
    const user = useUsersStore(state => state.user);
    const isSubmitting = useLoadingStore(selectSettlementAdding);
    const amountInputId = useId();
    const [currency, setCurrency] = useState(initialCurrency);
    const selectedBalance = selectSettlementBalance(balances, currency);
    const [amount, setAmount] = useState(() => getSettlementAmount(selectedBalance));
    const currencyItems: SelectItem[] = balances.map(balance => ({
        value: balance.currency,
        label: balance.currency,
    }));

    if (!user) {
        return null;
    }

    const settlement = getSettlementViewModel({
        user,
        friend,
        balance: selectedBalance,
        amount,
    });

    const onCurrencyChange = (nextCurrency: string) => {
        const nextBalance = selectSettlementBalance(balances, nextCurrency);

        setCurrency(nextCurrency);
        setAmount(getSettlementAmount(nextBalance));
    };

    const onFormSubmit = () => {
        onSubmit(settlement.params)
            .then(() => {
                toast.success(t('toasts:settlement.created'));
                onOpenChange(false);
            })
            .catch(error => {
                toast.error(t('toasts:settlement.createError'));
                console.error('Error creating settlement:', error);
            });
    };

    return (
        <BaseModal
            isOpened={isOpened}
            setIsOpened={onOpenChange}
            title={t('friends:settleUp.recordPayment')}
            accessibleDescription={t('friends:settleUp.noMoneyMoves')}
            maxWidth={MODAL_SIZES.default}
            content={
                <ModalSurface>
                    {onBack && (
                        <Flex>
                            <Button type="button" variant="ghost" color="gray" onClick={onBack}>
                                <LucideArrowLeft size={16} />
                                {t('common:buttons.back')}
                            </Button>
                        </Flex>
                    )}

                    <SettlementDebtSummary
                        friend={friend}
                        summaryUser={settlement.summaryUser}
                        isFriendPayer={settlement.isFriendPayer}
                        amount={settlement.maxAmount}
                        currency={currency}
                        color={settlement.debtColor}
                    />

                    <SettlementAmountField
                        inputId={amountInputId}
                        amount={amount}
                        currency={currency}
                        currencyItems={currencyItems}
                        onAmountChange={setAmount}
                        onCurrencyChange={onCurrencyChange}
                    />

                    <SettlementStatus
                        isDebtSettled={settlement.isDebtSettled}
                        remainingAmount={settlement.remainingAmount}
                        currency={currency}
                        color={settlement.debtColor}
                    />

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
                            onClick={() => onOpenChange(false)}
                        >
                            {t('common:buttons.cancel')}
                        </Button>

                        <Button
                            type="button"
                            size="4"
                            color="jade"
                            disabled={settlement.isSubmitDisabled}
                            loading={isSubmitting}
                            onClick={onFormSubmit}
                        >
                            {t('friends:settleUp.recordPayment')}
                        </Button>
                    </ActionFooter>
                </ModalSurface>
            }
        />
    );
};

export default SettlementForm;
