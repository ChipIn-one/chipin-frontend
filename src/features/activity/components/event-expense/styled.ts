import { Text } from '@radix-ui/themes';
import styled, { css } from 'styled-components';

import { Amount } from 'basics';

interface ReversedProps {
    $isReversed: boolean;
}

const reversedTextStyles = css<ReversedProps>`
    ${({ $isReversed }) =>
        $isReversed &&
        css`
            text-decoration: line-through;

            & > span {
                text-decoration: line-through;
            }
        `}
`;

const ExpenseAmount = styled(Amount)<ReversedProps>`
    ${reversedTextStyles}
`;

const ExpenseDebtAmount = styled(Amount)<ReversedProps>`
    ${reversedTextStyles}
`;

const ExpenseDebtText = styled(Text)<ReversedProps>`
    ${reversedTextStyles}
`;

const ExpenseDescription = styled(Text)<ReversedProps>`
    ${reversedTextStyles}
`;

const ExpensePaidAmountText = styled(Text)<ReversedProps>`
    ${reversedTextStyles}
`;

export {
    ExpenseAmount,
    ExpenseDebtAmount,
    ExpenseDebtText,
    ExpenseDescription,
    ExpensePaidAmountText,
};
