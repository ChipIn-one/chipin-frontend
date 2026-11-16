import { Text } from '@radix-ui/themes';
import styled from 'styled-components';

const ParticipantText = styled(Text)<{ $isReversed: boolean }>`
    text-decoration: ${({ $isReversed }) => ($isReversed ? 'line-through' : 'none')};
`;

export { ParticipantText };
