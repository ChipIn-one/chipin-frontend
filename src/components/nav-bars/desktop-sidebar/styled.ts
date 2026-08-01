import styled, { css } from 'styled-components';

import { Flex } from '@radix-ui/themes';

import { themeColor } from 'helpers/colors';

import { NavButton } from 'basics/buttons';

const SidebarSurface = styled(Flex)`
    position: sticky;
    top: calc(var(--space-6) + var(--space-4));
    width: 100%;
    height: calc(
        100dvh - var(--space-6) - var(--space-6) - var(--space-4) - var(--space-4)
    );
    overflow-y: auto;
    border: 1px solid ${themeColor('gray6')};
    border-radius: var(--radius-5);
    background-color: ${themeColor('gray2')};
    backdrop-filter: blur(10px);
`;

const SidebarNavButton = styled(NavButton)<{
    $isActive: boolean;
    $isSoloMode: boolean;
}>`
    position: relative;
    width: 100%;
    min-height: var(--space-8);
    justify-content: flex-start;

    &::before {
        content: '';
        position: absolute;
        top: 50%;
        left: calc(var(--space-5) * -1 - 1px);
        width: 4px;
        height: var(--space-7);
        border-radius: 0 var(--radius-2) var(--radius-2) 0;
        background-color: currentColor;
        box-shadow: 0 0 18px currentColor;
        opacity: 0;
        transform: translateY(-50%);
    }

    ${({ $isActive, $isSoloMode }) =>
        $isActive &&
        css`
            background: linear-gradient(
                90deg,
                ${themeColor($isSoloMode ? 'violet4' : 'green4')},
                transparent 82%
            );

            &::before {
                opacity: 1;
            }
        `}
`;

const ProfileNavButton = styled(NavButton)`
    width: 100%;
    min-width: 0;
    height: auto;
    justify-content: flex-start;
    text-align: left;
`;

export { ProfileNavButton, SidebarNavButton, SidebarSurface };
