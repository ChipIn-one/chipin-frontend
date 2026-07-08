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
    shares: Record<string, string>;
    onChangeShare: (userId: string, delta: number) => void;
    onShareInput: (userId: string, nextValue: string) => void;
    currency: string;
    yourShareAmount: number;
    isSummaryHidden?: boolean;
}

const SplitSharesSection = ({
    members,
    includedParticipantIds,
    includeParticipantLabel,
    onIncludedChange,
    isIncludeLocked = false,
    isParticipantLocked,
    isParticipantIncluded,
    shares,
    onChangeShare,
    onShareInput,
    currency,
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
                            value={shares[member.id] ?? '0'}
                            inputMode="numeric"
                            isDisabled={!isIncluded}
                            minLabel={t('expenses.modal.split.decreaseShare')}
                            plusLabel={t('expenses.modal.split.increaseShare')}
                            onChange={value => onShareInput(member.id, value)}
                            onStep={delta => onChangeShare(member.id, delta)}
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

export default SplitSharesSection;
