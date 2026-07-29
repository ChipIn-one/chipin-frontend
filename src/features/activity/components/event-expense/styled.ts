import { Amount, OwedStatusText } from 'basics';
import styled, { css } from 'styled-components';

import { Text } from '@radix-ui/themes';

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

const ExpenseDebt = styled(OwedStatusText)<ReversedProps>`
    ${reversedTextStyles}
`;

const ExpenseDescription = styled(Text)<ReversedProps>`
    ${reversedTextStyles}
`;

const ExpensePayer = styled(Text)<ReversedProps>`
    ${reversedTextStyles}
`;

export { ExpenseAmount, ExpenseDebt, ExpenseDescription, ExpensePayer };
