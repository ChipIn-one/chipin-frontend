import { useTranslation } from 'react-i18next';

import { Flex } from '@radix-ui/themes';

import {
    SplitParticipantRow,
    SplitSummaryFooter,
    SplitValueStepperInput,
} from 'components/modals/add-expense';
import type { ExpenseParticipant } from 'components/modals/add-expense/expenseParticipants';

interface Props {
    members: ExpenseParticipant[];
    includedParticipantIds: Record<string, boolean>;
    includeParticipantLabel: (name: string) => string;
    onIncludedChange: (userId: string, isIncluded: boolean) => void;
    isIncludeLocked?: boolean;
    isParticipantLocked?: (member: ExpenseParticipant) => boolean;
    isParticipantIncluded?: (member: ExpenseParticipant) => boolean;
    amountShares: Record<string, string>;
    onChangeAmount: (userId: string, delta: number) => void;
    onAmountInput: (userId: string, nextValue: string) => void;
    currency: string;
    step: number;
    yourShareAmount: number;
    isSummaryHidden?: boolean;
}

const SplitAmountsSection = ({
    members,
    includedParticipantIds,
    includeParticipantLabel,
    onIncludedChange,
    isIncludeLocked = false,
    isParticipantLocked,
    isParticipantIncluded,
    amountShares,
    onChangeAmount,
    onAmountInput,
    currency,
    step,
    yourShareAmount,
    isSummaryHidden = false,
}: Props) => {
    const { t } = useTranslation('group');

    return (
        <Flex direction="column" gap="3">
            {members.map(member => {
                const isIncluded =
                    isParticipantIncluded?.(member) ?? includedParticipantIds[member.id] !== false;

                return (
                    <SplitParticipantRow
                        key={member.id}
                        member={member}
                        isIncluded={isIncluded}
                        isIncludeLocked={isIncludeLocked || Boolean(isParticipantLocked?.(member))}
                        includeLabel={includeParticipantLabel(member.displayName)}
                        onIncludedChange={isNextIncluded =>
                            onIncludedChange(member.id, isNextIncluded)
                        }
                    >
                        <SplitValueStepperInput
                            value={amountShares[member.id] ?? '0'}
                            inputMode="decimal"
                            isDisabled={!isIncluded}
                            minLabel={t('expenses.modal.split.decreaseAmount')}
                            plusLabel={t('expenses.modal.split.increaseAmount')}
                            stepSize={step}
                            onChange={value => onAmountInput(member.id, value)}
                            onStep={delta => onChangeAmount(member.id, delta * step)}
                        />
                    </SplitParticipantRow>
                );
            })}

            {!isSummaryHidden && (
                <SplitSummaryFooter
                    label={t('expenses.modal.split.yourShare')}
                    amount={yourShareAmount}
                    currency={currency}
                />
            )}
        </Flex>
    );
};

export default SplitAmountsSection;
