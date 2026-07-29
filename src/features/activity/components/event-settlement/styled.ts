import styled from 'styled-components';

import { Text } from '@radix-ui/themes';

import { themeColor } from 'helpers/colors';

const AmountText = styled(Text)<{
    $isNegative: boolean;
    $isReversed: boolean;
}>`
    color: ${({ $isNegative }) => themeColor($isNegative ? 'red11' : 'green11')};
    text-decoration: ${({ $isReversed }) =>
        $isReversed ? 'line-through' : 'none'};
    white-space: nowrap;

    & > span {
        text-decoration: inherit;
    }
`;

export { AmountText };
