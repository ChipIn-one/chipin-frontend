import styled from 'styled-components';

import { Flex, Text } from '@radix-ui/themes';

import { GROUP_COVER_RATIO } from 'constants/groupCover';
import { themeColor } from 'helpers/colors';

import Image from 'basics/Image';

const PreviewCover = styled(Flex)`
    position: relative;
    overflow: hidden;
    aspect-ratio: ${GROUP_COVER_RATIO};
    color: ${themeColor('white')};
    background:
        radial-gradient(circle at 80% 18%, ${themeColor('violetA8')}, transparent 38%),
        linear-gradient(135deg, ${themeColor('grass9')}, ${themeColor('jade11')});
`;

const PreviewCoverScrim = styled.div`
    position: absolute;
    inset: 0;
    background: linear-gradient(
        to top,
        ${themeColor('black')} 0%,
        color-mix(in srgb, ${themeColor('black')} 56%, transparent) 28%,
        transparent 58%
    );
`;

const PreviewCoverImage = styled(Image)`
    position: absolute;
    inset: 0;

    && {
        object-fit: cover;
    }
`;

const PreviewDescription = styled(Text)`
    color: ${themeColor('white')};
    opacity: 0.78;
`;

export { PreviewCover, PreviewCoverImage, PreviewCoverScrim, PreviewDescription };
