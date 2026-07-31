import { memo, useId } from 'react';
import { Amount, Checkbox, UserAvatar } from 'basics';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import { Flex } from '@radix-ui/themes';
import { Text } from '@radix-ui/themes';

import {
    selectAmountStep,
    selectExpenseParticipant,
    selectIsDirectExpense,
    selectIsUserLocked,
    selectUserAmount,
    selectUserIds,
} from 'store/expenseModalSelectors';
import { useExpenseModalStore } from 'store/expenseModalStore';

import { ExpenseInputActions } from '../expense-input-actions';

import { getSplitParticipantControlData } from './helpers';
import { CheckSpacer, Controls, ParticipantLabel } from './styled';

interface ExpenseUserRowProps {
    participantId: string;
}

const ExpenseUserRow = memo(({ participantId }: ExpenseUserRowProps) => {
    const { t } = useTranslation('group');
    const checkboxId = useId();
    const {
        member,
        isUserIncluded,
        isIncludeLocked,
        isCheckSpacerHidden,
        calculatedAmount,
        currency,
        splitMode,
        percentValue,
        amountValue,
        shareValue,
        amountStep,
        setParticipantIncluded,
        setSplitValue,
        stepSplitValue,
    } = useExpenseModalStore(
        useShallow(state => ({
            member: selectExpenseParticipant(state, participantId),
            isUserIncluded: state.includedParticipantIds[participantId] !== false,
            isIncludeLocked: selectIsUserLocked(state, participantId),
            isCheckSpacerHidden: selectIsDirectExpense(state),
            calculatedAmount: selectUserAmount(state, participantId),
            currency: state.currency,
            splitMode: state.splitMode,
            percentValue: state.percentShares[participantId] ?? '0',
            amountValue: state.amountShares[participantId] ?? '0',
            shareValue: state.shareWeights[participantId] ?? '0',
            amountStep: selectAmountStep(state),
            setParticipantIncluded: state.setParticipantIncluded,
            setSplitValue: state.setSplitValue,
            stepSplitValue: state.stepSplitValue,
        })),
    );

    if (!member) {
        return null;
    }

    const controlData = getSplitParticipantControlData({
        splitMode,
        percentValue,
        amountValue,
        shareValue,
        amountStep,
        labels: {
            decreasePercent: t('expenses.modal.split.decreasePercent'),
            increasePercent: t('expenses.modal.split.increasePercent'),
            decreaseAmount: t('expenses.modal.split.decreaseAmount'),
            increaseAmount: t('expenses.modal.split.increaseAmount'),
            decreaseShare: t('expenses.modal.split.decreaseShare'),
            increaseShare: t('expenses.modal.split.increaseShare'),
        },
    });

    const includeLabel = t('expenses.modal.split.includeParticipant', {
        name: member.displayName,
    });
    let selectionControl = null;

    if (!isIncludeLocked) {
        selectionControl = (
            <Checkbox
                id={checkboxId}
                size="3"
                checked={isUserIncluded}
                aria-label={includeLabel}
                onCheckedChange={isChecked =>
                    setParticipantIncluded(participantId, isChecked === true)
                }
            />
        );
    } else if (!isCheckSpacerHidden) {
        selectionControl = <CheckSpacer />;
    }

    return (
        <Flex align="center" justify="between" gap="3" height="40px">
            <ParticipantLabel
                htmlFor={isIncludeLocked ? undefined : checkboxId}
                $isUserIncluded={isUserIncluded}
                $isLocked={isIncludeLocked}
            >
                {selectionControl}
                <UserAvatar user={member} size="2" />
                <Flex direction="column" align="start" minWidth="0">
                    <Text size="2" weight="medium" truncate>
                        {member.displayName}
                    </Text>
                    <Text size="1" color="gray">
                        <Amount value={calculatedAmount} tokenCode={currency} />
                    </Text>
                </Flex>
            </ParticipantLabel>
            <Controls $isUserIncluded={isUserIncluded}>
                {controlData ? (
                    <ExpenseInputActions
                        value={controlData.value}
                        inputMode={controlData.inputMode}
                        isDisabled={!isUserIncluded}
                        stepSize={controlData.stepSize}
                        minLabel={controlData.decreaseLabel}
                        plusLabel={controlData.increaseLabel}
                        onChange={nextValue =>
                            setSplitValue(participantId, nextValue)
                        }
                        onStep={delta =>
                            stepSplitValue(
                                participantId,
                                delta * controlData.stepSize,
                            )
                        }
                    />
                ) : null}
            </Controls>
        </Flex>
    );
});

ExpenseUserRow.displayName = 'ExpenseUserRow';

const ExpenseUsersList = () => {
    const participantIds = useExpenseModalStore(
        useShallow(selectUserIds),
    );

    return (
        <Flex direction="column" gap="3">
            {participantIds.map(participantId => (
                <ExpenseUserRow key={participantId} participantId={participantId} />
            ))}
        </Flex>
    );
};

export default ExpenseUsersList;
