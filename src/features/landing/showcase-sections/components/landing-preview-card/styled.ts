import styled from 'styled-components';

import { Card } from '@radix-ui/themes';

import { themeColor } from 'helpers/colors';

const PreviewBoundary = styled.div`
    width: 100%;
    pointer-events: none;
`;

const PreviewSurface = styled(Card)`
    width: 100%;
    overflow: hidden;
    padding: 0;
    border-color: ${themeColor('grayA6')};
    background-color: ${themeColor('gray1')};
    box-shadow:
        0 32px 80px -24px ${themeColor('grayA9')},
        0 16px 36px -24px ${themeColor('grayA8')};
`;

export { PreviewBoundary, PreviewSurface };
