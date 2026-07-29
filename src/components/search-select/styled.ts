import styled from 'styled-components';

import { ScrollArea } from '@radix-ui/themes';

import { themeColor } from 'helpers/colors';

const OptionsScrollArea = styled(ScrollArea)`
    height: 240px;
    background-color: ${themeColor('grayA2')};
`;

export { OptionsScrollArea };
