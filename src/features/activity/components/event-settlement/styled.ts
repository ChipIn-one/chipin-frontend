import styled from 'styled-components';

import { Text } from '@radix-ui/themes';

const AmountText = styled(Text)<{
    $isReversed: boolean;
}>`
    text-decoration: ${({ $isReversed }) =>
        $isReversed ? 'line-through' : 'none'};
    white-space: nowrap;

    & > span {
        text-decoration: inherit;
    }
`;

export { AmountText };
