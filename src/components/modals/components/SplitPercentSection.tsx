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
    percentShares: Record<string, string>;
    onChangePercent: (userId: string, delta: number) => void;
    onPercentInput: (userId: string, nextValue: string) => void;
    currency: string;
    yourShareAmount: number;
    isSummaryHidden?: boolean;
}

const SplitPercentSection = ({
    members,
    includedParticipantIds,
    includeParticipantLabel,
    onIncludedChange,
    isIncludeLocked = false,
    isParticipantLocked,
    isParticipantIncluded,
    percentShares,
    onChangePercent,
    onPercentInput,
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
                            value={percentShares[member.id] ?? '0'}
                            unit="%"
                            inputMode="numeric"
                            isDisabled={!isIncluded}
                            minLabel={t('expenses.modal.split.decreasePercent')}
                            plusLabel={t('expenses.modal.split.increasePercent')}
                            onChange={value => onPercentInput(member.id, value)}
                            onStep={delta => onChangePercent(member.id, delta)}
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

export default SplitPercentSection;
