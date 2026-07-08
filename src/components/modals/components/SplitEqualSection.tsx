import { Amount } from 'basics';
import { useTranslation } from 'react-i18next';

import { Flex, Text } from '@radix-ui/themes';

import { SplitParticipantRow, SplitSummaryFooter } from 'components/modals/add-expense';
import type { ExpenseParticipant } from 'components/modals/add-expense/expenseParticipants';

interface Props {
    members: ExpenseParticipant[];
    includedParticipantIds: Record<string, boolean>;
    includeParticipantLabel: (name: string) => string;
    onIncludedChange: (userId: string, isIncluded: boolean) => void;
    isIncludeLocked?: boolean;
    isParticipantLocked?: (member: ExpenseParticipant) => boolean;
    isParticipantIncluded?: (member: ExpenseParticipant) => boolean;
    totalAmount: string;
    currency: string;
    yourShareAmount: number;
    isSummaryHidden?: boolean;
}

const SplitEqualSection = ({
    members,
    includedParticipantIds,
    includeParticipantLabel,
    onIncludedChange,
    isIncludeLocked = false,
    isParticipantLocked,
    isParticipantIncluded,
    totalAmount,
    currency,
    yourShareAmount,
    isSummaryHidden = false,
}: Props) => {
    const { t } = useTranslation('group');

    const total = Number(totalAmount) || 0;
    const count = members.filter(member => includedParticipantIds[member.id] !== false).length;
    const perPerson = count > 0 ? Math.round((total / count) * 100) / 100 : 0;

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
                        <Text size="2" weight="medium">
                            <Amount value={isIncluded ? perPerson : 0} tokenCode={currency} />
                        </Text>
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

export default SplitEqualSection;
