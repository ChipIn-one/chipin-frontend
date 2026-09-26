import { LucideChevronDown } from 'lucide-react';
import styled from 'styled-components';

import { Button } from '@radix-ui/themes';

const ProfileButton = styled(Button)`
    width: 100%;
    min-width: 0;
    height: auto;
    justify-content: space-between;
    padding: var(--space-2);
    text-align: left;
`;

const ProfileChevron = styled(LucideChevronDown)<{ $isExpanded: boolean }>`
    flex-shrink: 0;
    transform: rotate(${({ $isExpanded }) => ($isExpanded ? '180deg' : '0deg')});
    transition: transform 160ms ease;
`;

const ProfileSignOutSlot = styled.div<{ $isExpanded: boolean }>`
    display: grid;
    grid-template-rows: ${({ $isExpanded }) => ($isExpanded ? '1fr' : '0fr')};
    opacity: ${({ $isExpanded }) => ($isExpanded ? 1 : 0)};
    transition:
        grid-template-rows 160ms ease,
        opacity 120ms ease;
`;

const ProfileSignOutContent = styled.div`
    min-height: 0;
    overflow: hidden;

    & > button {
        width: 100%;
        margin-top: var(--space-2);
    }
`;

export { ProfileButton, ProfileChevron, ProfileSignOutContent, ProfileSignOutSlot };
