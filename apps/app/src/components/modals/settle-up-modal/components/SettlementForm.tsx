import { useTranslation } from 'react-i18next';

import { BaseModal, MODAL_SIZES } from '../../base-modal';
import { OverlayBody } from '../../components';
import type { SettlementFormProps } from '../internal';
import { useSettleUpRefusal } from '../internal/useSettleUpRefusal';

import { SettlementFormContent } from './SettlementFormContent';
import { SettleUpQueuedHint } from './SettleUpQueuedHint';

const SettlementForm = ({
    isOpened,
    onOpenChange,
    friend,
    balances,
    initialCurrency,
    onSubmit,
}: SettlementFormProps) => {
    const { t } = useTranslation('friends');
    const refusal = useSettleUpRefusal(null);

    return (
        <BaseModal
            isOpened={isOpened}
            setIsOpened={onOpenChange}
            title={t('friends:settleUp.recordPayment')}
            accessibleDescription={t('friends:settleUp.noMoneyMoves')}
            maxWidth={MODAL_SIZES.default}
            content={
                refusal !== null ? (
                    <OverlayBody>
                        <SettleUpQueuedHint
                            isGroup={false}
                            reason={refusal}
                            onClose={() => onOpenChange(false)}
                        />
                    </OverlayBody>
                ) : (
                    <SettlementFormContent
                        friend={friend}
                        balances={balances}
                        initialCurrency={initialCurrency}
                        onSubmit={onSubmit}
                        onClose={() => onOpenChange(false)}
                    />
                )
            }
        />
    );
};

export default SettlementForm;
