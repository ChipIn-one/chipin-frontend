import styled, { css } from 'styled-components';

import { Card } from '@radix-ui/themes';

import { themeColor } from 'helpers/colors';

import { NavButton } from 'basics/buttons';

const getSidebarNavHighlightStyles = (isSoloMode: boolean) => css`
    background: linear-gradient(
        90deg,
        ${themeColor(isSoloMode ? 'violet4' : 'green4')},
        transparent 82%
    );

    &::before {
        opacity: 1;
    }
`;

const SidebarSurface = styled(Card)`
    position: sticky;
    top: calc(var(--space-6) + var(--space-4));
    width: 100%;
    height: calc(100dvh - var(--space-6) - var(--space-6) - var(--space-4) - var(--space-4));
    overflow-y: auto;
`;

const SidebarNavButton = styled(NavButton)<{
    $isActive: boolean;
    $isSoloMode: boolean;
}>`
    position: relative;
    width: 100%;
    min-height: var(--space-8);
    margin: 0;
    justify-content: flex-start;

    &::before {
        content: '';
        position: absolute;
        top: 50%;
        left: calc(var(--space-4) * -1);
        width: 4px;
        height: var(--space-7);
        border-radius: 0 var(--radius-2) var(--radius-2) 0;
        background-color: currentColor;
        box-shadow: 0 0 20px currentColor;
        opacity: 0;
        transform: translateY(-50%);
    }

    ${({ $isActive, $isSoloMode }) => $isActive && getSidebarNavHighlightStyles($isSoloMode)}

    ${({ $isSoloMode }) => css`
        &:hover {
            ${getSidebarNavHighlightStyles($isSoloMode)}
        }
    `}
`;

export { SidebarNavButton, SidebarSurface };
