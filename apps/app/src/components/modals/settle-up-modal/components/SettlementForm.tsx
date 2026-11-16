import { useTranslation } from 'react-i18next';

import { BaseModal, MODAL_SIZES } from '../../base-modal';
import type { SettlementFormProps } from '../internal';

import SettlementFormContent from './SettlementFormContent';

const SettlementForm = ({
    isOpened,
    onOpenChange,
    friend,
    balances,
    initialCurrency,
    onSubmit,
}: SettlementFormProps) => {
    const { t } = useTranslation('friends');

    return (
        <BaseModal
            isOpened={isOpened}
            setIsOpened={onOpenChange}
            title={t('friends:settleUp.recordPayment')}
            accessibleDescription={t('friends:settleUp.noMoneyMoves')}
            maxWidth={MODAL_SIZES.default}
            content={
                <SettlementFormContent
                    friend={friend}
                    balances={balances}
                    initialCurrency={initialCurrency}
                    onSubmit={onSubmit}
                    onClose={() => onOpenChange(false)}
                />
            }
        />
    );
};

export default SettlementForm;
