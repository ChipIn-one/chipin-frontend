import { useState } from 'react';
import { LucideArrowLeftRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button, Text } from '@radix-ui/themes';

import { useActivityStore } from 'store/activity-store';
import { selectGroupSettlementOptions } from 'store/groupsSelectors';
import { useUsersStore } from 'store/users-store';

import { MODAL_SIZES } from '../../base-modal';
import { OverlayBody, OverlayFooter } from '../../components';
import { ModalRouter, type ModalRoute } from '../../modal-router';
import { type DebtOption, getDebtOptions } from '../internal';
import type { GroupSettleUpProps } from '../types';

import DebtSelectionStep from './DebtSelectionStep';
import SettlementFormContent from './SettlementFormContent';

const SETTLEMENT_ROUTES = {
    CHOOSE: 'choose',
    PAYMENT: 'payment',
} as const;

type SettlementRouteId = (typeof SETTLEMENT_ROUTES)[keyof typeof SETTLEMENT_ROUTES];

const GroupSettleUpFlow = ({ group, memberId }: GroupSettleUpProps) => {
    const { t } = useTranslation(['group', 'common', 'friends']);
    const currentUser = useUsersStore(state => state.user);
    const [isOpened, setIsOpened] = useState(false);
    const [selectedDebt, setSelectedDebt] = useState<DebtOption | null>(null);
    const [isYouOweExpanded, setIsYouOweExpanded] = useState(false);
    const [isOwedToYouExpanded, setIsOwedToYouExpanded] = useState(false);
    const groupSettlementOptions = currentUser
        ? selectGroupSettlementOptions(group, currentUser.id)
        : { youOwe: [], owedToYou: [] };
    const settlementOptions = memberId
        ? {
              youOwe: groupSettlementOptions.youOwe.filter(
                  option => option.user.id === memberId,
              ),
              owedToYou: groupSettlementOptions.owedToYou.filter(
                  option => option.user.id === memberId,
              ),
          }
        : groupSettlementOptions;
    const youOwe = getDebtOptions(settlementOptions.youOwe);
    const owedToYou = getDebtOptions(settlementOptions.owedToYou);
    const debts = [...youOwe, ...owedToYou];
    const isSettledMember = Boolean(memberId) && debts.length === 0;
    // Retain the selected debt if a successful mutation refreshes balances before closing.
    const selectedOption = selectedDebt
        ? (debts.find(
              debt =>
                  debt.user.id === selectedDebt.user.id &&
                  debt.balance.currency === selectedDebt.balance.currency,
          ) ?? selectedDebt)
        : undefined;

    const onOpenChange = (isOpen: boolean) => {
        setIsOpened(isOpen);

        if (!isOpen) {
            setSelectedDebt(null);
            setIsYouOweExpanded(false);
            setIsOwedToYouExpanded(false);
        }
    };

    const routes: Record<SettlementRouteId, ModalRoute<SettlementRouteId>> = {
        [SETTLEMENT_ROUTES.CHOOSE]: {
            title: t('group:page.settleUp.chooseDebtTitle'),
            accessibleDescription: t('group:page.settleUp.chooseDebtAccessibleDescription'),
            render: navigation => (
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
                selectedOption ? (
                    <SettlementFormContent
                        key={selectedOption.user.id + '-' + selectedOption.balance.currency}
                        friend={selectedOption.user}
                        balances={selectedOption.balances}
                        initialCurrency={selectedOption.balance.currency}
                        onSubmit={params => useActivityStore
                            .getState()
                            .createSettlement({ ...params, groupId: group.id })}
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
                <Button
                    size={memberId ? '1' : '2'}
                    color="green"
                    variant={memberId ? 'soft' : 'solid'}
                    disabled={debts.length === 0}
                >
                    <LucideArrowLeftRight size={15} />
                    {t(
                        isSettledMember
                            ? 'group:page.balances.settled'
                            : 'common:buttons.settleUp',
                    )}
                </Button>
            }
        />
    );
};

export default GroupSettleUpFlow;
