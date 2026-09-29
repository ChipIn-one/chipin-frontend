import styled from 'styled-components';

import { Box, Flex } from '@radix-ui/themes';

import { NavButton } from 'basics/buttons';

const MobileNavBarWrapper = styled(Box)`
    --mobile-nav-action-lift: var(--space-3);
    --mobile-nav-cutout-center-y: calc(0px - var(--mobile-nav-action-lift));

    /* Keep the persistent navigation above in-flow content without competing with Radix portals. */
    z-index: 0;
    overflow: visible;
`;

const MobileNavSurface = styled(Box)`
    --mobile-nav-cutout-radius: calc(var(--space-7) - var(--space-1));

    position: absolute;
    inset: 0;
    background: ${({ theme }) =>
        `radial-gradient(circle var(--mobile-nav-cutout-radius) at 50% var(--mobile-nav-cutout-center-y), transparent var(--mobile-nav-cutout-radius), ${theme.colors['grass3']} var(--mobile-nav-cutout-radius))`};
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
    transform: translate(-50%, calc(-50% - var(--mobile-nav-action-lift)));
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
