import { useState } from 'react';
import { Button, Text } from '@radix-ui/themes';
import { ArrowLeftRightIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ONLINE_ONLY_ACTIONS } from 'constants/onlineOnlyActions';
import { useCreateSettlement } from 'hooks/useLedgerMutations';
import { useRequiresOnline } from 'hooks/useRequiresOnline';
import { useSelfUser } from 'hooks/useSelfUser';
import { selectGroupSettlementOptions } from 'store/groupsSelectors';

import { OnlineOnly } from 'components/online-only';

import { MODAL_SIZES } from '../../base-modal';
import { OverlayBody, OverlayFooter } from '../../components';
import { type ModalNavigation, type ModalRoute, ModalRouter } from '../../modal-router';
import { type DebtOption, getDebtOptions } from '../internal';
import { useSettleUpRefusal } from '../internal/useSettleUpRefusal';
import type { GroupSettleUpProps } from '../types';

import DebtSelectionStep from './DebtSelectionStep';
import { SettlementFormContent } from './SettlementFormContent';
import { SettleUpQueuedHint } from './SettleUpQueuedHint';

const SETTLEMENT_ROUTES = {
    CHOOSE: 'choose',
    PAYMENT: 'payment',
} as const;

type SettlementRouteId = (typeof SETTLEMENT_ROUTES)[keyof typeof SETTLEMENT_ROUTES];

const GroupSettleUpFlow = ({ group, memberId }: GroupSettleUpProps) => {
    const { t } = useTranslation(['group', 'common', 'friends']);
    const currentUser = useSelfUser();
    const { createSettlement } = useCreateSettlement();
    const [isOpened, setIsOpened] = useState(false);
    const [selectedDebt, setSelectedDebt] = useState<DebtOption | null>(null);
    const [isSettlementPending, setIsSettlementPending] = useState(false);
    const [isYouOweExpanded, setIsYouOweExpanded] = useState(false);
    const [isOwedToYouExpanded, setIsOwedToYouExpanded] = useState(false);
    // §2.9: the flow is closed entirely while settle-up needs the network it does not have.
    const isOnlineRequired = useRequiresOnline(ONLINE_ONLY_ACTIONS.settleUp);
    // 03-16a part C: refused while expenses of this group are unsent (a started payment finishes).
    const groupRefusal = useSettleUpRefusal(group.id);
    const refusal = isSettlementPending ? null : groupRefusal;
    const groupSettlementOptions = currentUser
        ? selectGroupSettlementOptions(group, currentUser.id)
        : { youOwe: [], owedToYou: [] };
    const settlementOptions = memberId
        ? {
              youOwe: groupSettlementOptions.youOwe.filter(option => option.user.id === memberId),
              owedToYou: groupSettlementOptions.owedToYou.filter(
                  option => option.user.id === memberId,
              ),
          }
        : groupSettlementOptions;
    const youOwe = getDebtOptions(settlementOptions.youOwe);
    const owedToYou = getDebtOptions(settlementOptions.owedToYou);
    const debts = [...youOwe, ...owedToYou];
    const isSettledMember = Boolean(memberId) && debts.length === 0;
    // Prevent submitting stale debt data. Retain the snapshot only while
    // this modal's already-started settlement request is completing.
    const selectedOption = selectedDebt
        ? (debts.find(
              debt =>
                  debt.user.id === selectedDebt.user.id &&
                  debt.balance.net.currency === selectedDebt.balance.net.currency,
          ) ?? (isSettlementPending ? selectedDebt : undefined))
        : undefined;

    const onOpenChange = (isOpen: boolean) => {
        setIsOpened(isOpen);

        if (!isOpen) {
            setSelectedDebt(null);
            setIsYouOweExpanded(false);
            setIsOwedToYouExpanded(false);
        }
    };

    // §2.9: the network went away with the flow open: it is closed (and stays closed when the
    // network comes back), as if the user closed it.
    // N4: a payment already sent finishes first.
    if (isOpened && isOnlineRequired && !isSettlementPending) {
        onOpenChange(false);
    }

    const renderRefusal = (
        navigation: ModalNavigation<SettlementRouteId>,
        reason: 'queued' | 'checking',
    ) => (
        <OverlayBody>
            <SettleUpQueuedHint isGroup reason={reason} onClose={navigation.close} />
        </OverlayBody>
    );

    const routes: Record<SettlementRouteId, ModalRoute<SettlementRouteId>> = {
        [SETTLEMENT_ROUTES.CHOOSE]: {
            title: t('group:page.settleUp.chooseDebtTitle'),
            accessibleDescription: t('group:page.settleUp.chooseDebtAccessibleDescription'),
            render: navigation =>
                refusal !== null ? (
                    renderRefusal(navigation, refusal)
                ) : (
                    <>
                        <OverlayBody maxHeight="min(60dvh, 640px)">
                            <DebtSelectionStep
                                youOwe={youOwe}
                                owedToYou={owedToYou}
                                isYouOweExpanded={isYouOweExpanded}
                                isOwedToYouExpanded={isOwedToYouExpanded}
                                onToggleYouOwe={() =>
                                    setIsYouOweExpanded(isExpanded => !isExpanded)
                                }
                                onToggleOwedToYou={() =>
                                    setIsOwedToYouExpanded(isExpanded => !isExpanded)
                                }
                                onSelect={debt => {
                                    setSelectedDebt(debt);
                                    navigation.push(SETTLEMENT_ROUTES.PAYMENT);
                                }}
                            />
                        </OverlayBody>
                        <OverlayFooter
                            cancelAction={
                                <Button
                                    type="button"
                                    size="4"
                                    variant="soft"
                                    color="gray"
                                    onClick={navigation.close}
                                >
                                    {t('common:buttons.cancel')}
                                </Button>
                            }
                            primaryAction={null}
                        />
                    </>
                ),
        },
        [SETTLEMENT_ROUTES.PAYMENT]: {
            title: t('friends:settleUp.recordPayment'),
            accessibleDescription: t('friends:settleUp.noMoneyMoves'),
            render: navigation =>
                refusal !== null ? (
                    renderRefusal(navigation, refusal)
                ) : selectedOption ? (
                    <SettlementFormContent
                        key={selectedOption.user.id + '-' + selectedOption.balance.net.currency}
                        friend={selectedOption.user}
                        balances={selectedOption.balances}
                        initialCurrency={selectedOption.balance.net.currency}
                        onSubmit={settlement => {
                            setIsSettlementPending(true);

                            return createSettlement({
                                settlement: { ...settlement, groupId: group.id },
                            }).finally(() => setIsSettlementPending(false));
                        }}
                        onClose={navigation.close}
                    />
                ) : (
                    <OverlayBody>
                        <Text color="gray">{t('group:page.balances.settled')}</Text>
                    </OverlayBody>
                ),
        },
    };

    return (
        <ModalRouter<SettlementRouteId>
            isOpened={isOpened}
            onOpenChange={onOpenChange}
            initialRoute={SETTLEMENT_ROUTES.CHOOSE}
            routes={routes}
            maxWidth={MODAL_SIZES.default}
            triggerElement={
                <OnlineOnly action={ONLINE_ONLY_ACTIONS.settleUp}>
                    <Button
                        size={memberId ? '1' : '2'}
                        color="green"
                        variant={memberId ? 'soft' : 'solid'}
                        disabled={debts.length === 0}
                    >
                        <ArrowLeftRightIcon size={15} />
                        {t(
                            isSettledMember
                                ? 'group:page.balances.settled'
                                : 'common:buttons.settleUp',
                        )}
                    </Button>
                </OnlineOnly>
            }
        />
    );
};

export default GroupSettleUpFlow;
