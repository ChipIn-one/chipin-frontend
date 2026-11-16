import { Text } from '@radix-ui/themes';
import styled from 'styled-components';

const AmountText = styled(Text)<{
    $isReversed: boolean;
}>`
    text-decoration: ${({ $isReversed }) => ($isReversed ? 'line-through' : 'none')};

    & > span {
        text-decoration: inherit;
    }
`;

export { AmountText };
