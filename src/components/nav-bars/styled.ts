import styled from 'styled-components';

import { Box, Flex } from '@radix-ui/themes';

import { NavButton } from 'basics/buttons';

const MobileNavBarWrapper = styled(Box)`
    /* Keep the persistent navigation above in-flow content without competing with Radix portals. */
    z-index: 0;
    overflow: visible;
`;

const MobileNavSurface = styled(Box)`
    position: absolute;
    inset: 0;
    background: ${({ theme }) =>
        `radial-gradient(circle var(--space-7) at 50% 0, transparent var(--space-7), ${theme.colors['grass3']} calc(var(--space-7)))`};
`;

const MobileNavContent = styled(Flex)`
    position: relative;
    min-height: var(--space-9);
    align-items: end;
`;

const MobileNavCenterAction = styled(Box)`
    position: absolute;
    top: 0;
    left: 50%;
    transform: translate(-50%, -50%);
`;

const MobileNavItems = styled(Flex)`
    width: 100%;
    align-items: end;
`;

const MobileNavItemButton = styled(NavButton)`
    width: 100%;
    min-height: var(--space-9);
    box-shadow: none;
`;

export {
    MobileNavBarWrapper,
    MobileNavCenterAction,
    MobileNavContent,
    MobileNavItemButton,
    MobileNavItems,
    MobileNavSurface,
};
