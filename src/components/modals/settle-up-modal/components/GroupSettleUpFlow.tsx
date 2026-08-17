import { useState } from 'react';
import { LucideArrowLeftRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@radix-ui/themes';

import { selectGroupSettlementOptions } from 'store/groupsSelectors';
import { useGroupsStore } from 'store/groupsStore';
import { useUsersStore } from 'store/users-store';

import { BaseModal, MODAL_SIZES } from '../../base-modal';
import { OverlayBody, OverlayFooter } from '../../components';
import { type DebtOption, getDebtOptions } from '../internal';
import type { GroupSettleUpProps } from '../types';

import DebtSelectionStep from './DebtSelectionStep';
import SettlementForm from './SettlementForm';

const GroupSettleUpFlow = ({ group, memberId }: GroupSettleUpProps) => {
    const { t } = useTranslation(['group', 'common']);
    const currentUser = useUsersStore(state => state.user);
    const createSettlement = useGroupsStore(state => state.createSettlement);
    const [isOpened, setIsOpened] = useState(false);
    const [selectedDebt, setSelectedDebt] = useState<Pick<DebtOption, 'user' | 'balance'> | null>(
        null,
    );
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
    const selectedOption = selectedDebt
        ? debts.find(
              debt =>
                  debt.user.id === selectedDebt.user.id &&
                  debt.balance.currency === selectedDebt.balance.currency,
          )
        : undefined;

    const onOpenChange = (isOpen: boolean) => {
        setIsOpened(isOpen);

        if (!isOpen) {
            setSelectedDebt(null);
            setIsYouOweExpanded(false);
            setIsOwedToYouExpanded(false);
        }
    };

    if (selectedOption) {
        return (
            <SettlementForm
                isOpened={isOpened}
                onOpenChange={onOpenChange}
                friend={selectedOption.user}
                balances={selectedOption.balances}
                initialCurrency={selectedOption.balance.currency}
                onSubmit={createSettlement}
                onBack={() => setSelectedDebt(null)}
            />
        );
    }

    return (
        <BaseModal
            isOpened={isOpened}
            setIsOpened={onOpenChange}
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
            title={t('group:page.settleUp.chooseDebtTitle')}
            accessibleDescription={t('group:page.settleUp.chooseDebtAccessibleDescription')}
            maxWidth={MODAL_SIZES.default}
            content={
                <>
                    <OverlayBody>
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
                            onSelect={setSelectedDebt}
                        />
                    </OverlayBody>
                    <OverlayFooter
                        cancelAction={
                            <Button
                                type="button"
                                size="4"
                                variant="soft"
                                color="gray"
                                onClick={() => onOpenChange(false)}
                            >
                                {t('common:buttons.cancel')}
                            </Button>
                        }
                        primaryAction={null}
                    />
                </>
            }
        />
    );
};

export default GroupSettleUpFlow;
