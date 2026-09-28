import styled from 'styled-components';

import { Button, Popover, ScrollArea } from '@radix-ui/themes';

import { themeColor } from 'helpers/colors';

const SearchSelectContent = styled(Popover.Content)`
    display: flex;
    flex-direction: column;
    overflow: hidden;
`;

const OptionsScrollArea = styled(ScrollArea)`
    height: 240px;
    min-height: 0;
    flex-shrink: 1;
    background-color: ${themeColor('grayA2')};

    & [data-radix-scroll-area-viewport] > div {
        display: block !important;
        width: 100%;
        min-width: 0 !important;
    }
`;

const OptionButton = styled(Button)`
    width: 100%;
    min-width: 0;
`;

export { OptionButton, OptionsScrollArea, SearchSelectContent };
