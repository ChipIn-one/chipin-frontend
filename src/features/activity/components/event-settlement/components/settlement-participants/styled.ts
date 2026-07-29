import styled from 'styled-components';

import { Text } from '@radix-ui/themes';

const ParticipantText = styled(Text)<{ $isReversed: boolean }>`
    text-decoration: ${({ $isReversed }) =>
        $isReversed ? 'line-through' : 'none'};
`;

export { ParticipantText };
