import styled, { keyframes } from 'styled-components';

import { Box, Button } from '@radix-ui/themes';

import { themeColor } from 'helpers/colors';

const expandSearch = keyframes`
    from {
        opacity: 0;
        transform: scaleX(0.88);
    }

    to {
        opacity: 1;
        transform: scaleX(1);
    }
`;

const SearchFieldShell = styled(Box)`
    min-width: 0;
    transform-origin: left center;
    animation: ${expandSearch} 160ms ease-out;
`;

const SearchButtonShell = styled.span`
    position: relative;
    display: inline-flex;
`;

const SearchIndicator = styled.span`
    position: absolute;
    top: 1px;
    right: 1px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${themeColor('grass9')};
    pointer-events: none;
`;

const SettledToggleButton = styled(Button)`
    width: 100%;
`;

export {
    SearchButtonShell,
    SearchFieldShell,
    SearchIndicator,
    SettledToggleButton,
};
