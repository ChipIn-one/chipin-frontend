import styled from 'styled-components';

import { themeColor } from 'helpers/colors';

export const ParticipantLabel = styled.label<{
    $isUserIncluded: boolean;
    $isLocked: boolean;
}>`
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    flex: 1;
    cursor: ${({ $isLocked }) => ($isLocked ? 'default' : 'pointer')};
    color: ${({ $isUserIncluded }) =>
        $isUserIncluded ? themeColor('gray12') : themeColor('gray10')};
`;

export const CheckSpacer = styled.span`
    width: 20px;
    height: 20px;
    flex-shrink: 0;
`;

export const Controls = styled.div<{ $isUserIncluded: boolean }>`
    opacity: ${({ $isUserIncluded }) => ($isUserIncluded ? 1 : 0.55)};
    transition: opacity 150ms ease;
`;
