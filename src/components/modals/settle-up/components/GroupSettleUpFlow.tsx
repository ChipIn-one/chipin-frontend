import { useState } from 'react';
import { LucideArrowLeftRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@radix-ui/themes';

import { selectGroupSettlementOptions } from 'store/groupsSelectors';
import { useGroupsStore } from 'store/groupsStore';
import { useUsersStore } from 'store/usersStore';

import { BaseModal, MODAL_SIZES } from '../../base-modal';
import { type DebtOption, helpers } from '../internal';
import type { GroupSettleUpProps } from '../types';

import DebtSelectionStep from './DebtSelectionStep';
import SettlementForm from './SettlementForm';

const GroupSettleUpFlow = ({ group }: GroupSettleUpProps) => {
    const { t } = useTranslation(['group', 'common']);
    const currentUser = useUsersStore(state => state.user);
    const createSettlement = useGroupsStore(state => state.createSettlement);
    const [isOpened, setIsOpened] = useState(false);
    const [selectedDebt, setSelectedDebt] = useState<Pick<DebtOption, 'user' | 'balance'> | null>(
        null,
    );
    const [isYouOweExpanded, setIsYouOweExpanded] = useState(false);
    const [isOwedToYouExpanded, setIsOwedToYouExpanded] = useState(false);
    const settlementOptions = currentUser
        ? selectGroupSettlementOptions(group, currentUser.id)
        : { youOwe: [], owedToYou: [] };
    const youOwe = helpers.getDebtOptions(settlementOptions.youOwe);
    const owedToYou = helpers.getDebtOptions(settlementOptions.owedToYou);
    const debts = [...youOwe, ...owedToYou];
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
                <Button size="2" color="green" disabled={debts.length === 0}>
                    <LucideArrowLeftRight size={15} />
                    {t('common:buttons.settleUp')}
                </Button>
            }
            title={t('group:page.settleUp.chooseDebtTitle')}
            accessibleDescription={t('group:page.settleUp.chooseDebtAccessibleDescription')}
            maxWidth={MODAL_SIZES.default}
            content={
                <DebtSelectionStep
                    youOwe={youOwe}
                    owedToYou={owedToYou}
                    isYouOweExpanded={isYouOweExpanded}
                    isOwedToYouExpanded={isOwedToYouExpanded}
                    onToggleYouOwe={() => setIsYouOweExpanded(isExpanded => !isExpanded)}
                    onToggleOwedToYou={() =>
                        setIsOwedToYouExpanded(isExpanded => !isExpanded)
                    }
                    onSelect={setSelectedDebt}
                />
            }
        />
    );
};

export default GroupSettleUpFlow;
