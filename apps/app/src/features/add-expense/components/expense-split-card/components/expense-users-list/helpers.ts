import { EXPENSE_SPLIT_MODES, type ExpenseSplitMode } from 'constants/chipin';

interface SplitControlLabels {
    amountInput: string;
    decreaseAmount: string;
    decreasePercent: string;
    decreaseShare: string;
    increaseAmount: string;
    increasePercent: string;
    increaseShare: string;
    percentInput: string;
    shareInput: string;
}

interface SplitParticipantControlParams {
    amountStep: number;
    amountValue: string;
    labels: SplitControlLabels;
    percentValue: string;
    shareValue: string;
    splitMode: ExpenseSplitMode;
}

export interface SplitParticipantControlData {
    decreaseLabel: string;
    increaseLabel: string;
    inputLabel: string;
    inputMode: 'decimal' | 'numeric';
    stepSize: number;
    value: string;
}

export const getSplitParticipantControlData = ({
    amountStep,
    amountValue,
    labels,
    percentValue,
    shareValue,
    splitMode,
}: SplitParticipantControlParams): SplitParticipantControlData | null => {
    switch (splitMode) {
        case EXPENSE_SPLIT_MODES.PERCENT:
            return {
                value: percentValue,
                inputMode: 'numeric',
                stepSize: 1,
                decreaseLabel: labels.decreasePercent,
                increaseLabel: labels.increasePercent,
                inputLabel: labels.percentInput,
            };
        case EXPENSE_SPLIT_MODES.AMOUNTS:
            return {
                value: amountValue,
                inputMode: 'decimal',
                stepSize: amountStep,
                decreaseLabel: labels.decreaseAmount,
                increaseLabel: labels.increaseAmount,
                inputLabel: labels.amountInput,
            };
        case EXPENSE_SPLIT_MODES.SHARES:
            return {
                value: shareValue,
                inputMode: 'numeric',
                stepSize: 1,
                decreaseLabel: labels.decreaseShare,
                increaseLabel: labels.increaseShare,
                inputLabel: labels.shareInput,
            };
        case EXPENSE_SPLIT_MODES.EQUAL:
            return null;
    }
};
