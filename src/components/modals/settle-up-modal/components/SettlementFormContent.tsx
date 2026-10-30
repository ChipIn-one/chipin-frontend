import { useId, useRef, useState } from 'react';
import { InfoIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { Button, Callout } from '@radix-ui/themes';

import { resolveApiErrorMessageFromError } from 'helpers/errors';

import type { SelectItem } from 'components/Select';

import { OverlayBody, OverlayFooter } from '../../components';
import {
    getHalfSettlementAmount,
    getSettlementAmount,
    getSettlementViewModel,
    selectSettlementBalance,
    useConnect,
} from '../internal';
import { ModalSurface } from '../styled';
import type { FriendSettleUpProps } from '../types';

import SettlementAmountField from './SettlementAmountField';
import SettlementDebtSummary from './SettlementDebtSummary';
import SettlementStatus from './SettlementStatus';

interface Props extends Pick<
    FriendSettleUpProps,
    'friend' | 'balances' | 'initialCurrency' | 'onSubmit'
> {
    onClose: () => void;
}

const SettlementFormContent = ({
    friend,
    balances,
    initialCurrency,
    onSubmit,
    onClose,
}: Props) => {
    const { t } = useTranslation(['common', 'friends', 'toasts']);
    const { user, isSubmitting } = useConnect();
    const amountInputId = useId();
    const [currency, setCurrency] = useState(initialCurrency);
    const isSubmitInFlight = useRef(false);
    const [isSubmitPending, setIsSubmitPending] = useState(false);
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
        if (isSubmitInFlight.current || isSubmitting || settlement.isSubmitDisabled) {
            return;
        }

        // A ref also prevents a second click before React flushes the loading state.
        isSubmitInFlight.current = true;
        setIsSubmitPending(true);

        onSubmit(settlement.params)
            .then(() => {
                onClose();
                toast.success(t('toasts:settlement.created'));
            })
            .catch(error => {
                toast.error(resolveApiErrorMessageFromError(
                    error,
                    t('toasts:common.requestFailed'),
                ));
            })
            .finally(() => {
                isSubmitInFlight.current = false;
                setIsSubmitPending(false);
            });
    };

    return (
        <>
            <OverlayBody>
                <ModalSurface>
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
                        onUseFullDebt={() => setAmount(getSettlementAmount(selectedBalance))}
                        onUseHalfDebt={() => setAmount(getHalfSettlementAmount(selectedBalance))}
                    />

                    <SettlementStatus
                        isDebtSettled={settlement.isDebtSettled}
                        remainingAmount={settlement.remainingAmount}
                        currency={currency}
                        color={settlement.debtColor}
                    />

                    <Callout.Root color="grass" size="2">
                        <Callout.Icon>
                            <InfoIcon size={18} />
                        </Callout.Icon>
                        <Callout.Text>
                            {t('friends:settleUp.noMoneyMoves')}
                        </Callout.Text>
                    </Callout.Root>
                </ModalSurface>
            </OverlayBody>

            <OverlayFooter
                cancelAction={
                    <Button
                        type="button"
                        size="4"
                        variant="soft"
                        color="gray"
                        onClick={onClose}
                    >
                        {t('common:buttons.cancel')}
                    </Button>
                }
                primaryAction={
                    <Button
                        type="button"
                        size="4"
                        color="grass"
                        disabled={settlement.isSubmitDisabled || isSubmitting || isSubmitPending}
                        loading={isSubmitting || isSubmitPending}
                        onClick={onFormSubmit}
                    >
                        {t('friends:settleUp.recordPayment')}
                    </Button>
                }
            />
        </>
    );
};

export default SettlementFormContent;
