import styled from 'styled-components';

import { Button, ScrollArea } from '@radix-ui/themes';

import { themeColor } from 'helpers/colors';

const OptionsScrollArea = styled(ScrollArea)`
    height: 240px;
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

export { OptionButton, OptionsScrollArea };
