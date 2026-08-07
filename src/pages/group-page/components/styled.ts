import styled from 'styled-components';

import { Box, Flex } from '@radix-ui/themes';

import { MEDIA_QUERIES } from 'constants/breakpoints';
import { GROUP_COVER_OBJECT_POSITION } from 'constants/groupCover';
import { themeColor } from 'helpers/colors';

import Image from 'basics/Image';

const CoverWrapper = styled(Flex)<{ $hasCover: boolean }>`
    overflow: hidden;
    color: ${({ $hasCover }) =>
        $hasCover ? themeColor('white') : 'inherit'};
    border: 1px solid ${themeColor('gray6')};
    border-radius: var(--radius-5);

    @media ${MEDIA_QUERIES.belowSm} {
        border-radius: 0;
    }
`;

const CoverBackground = styled(Box)`
    position: absolute;
    inset: 0;
`;

const CoverGradient = styled(CoverBackground)`
    background: linear-gradient(
        to top,
        ${themeColor('black')} 0%,
        color-mix(in srgb, ${themeColor('black')} 72%, transparent) 58%,
        transparent 100%
    );
    pointer-events: none;
`;

const GroupCoverImage = styled(Image)`
    position: absolute;
    inset: 0;
    color: ${themeColor('gray11')};

    && {
        object-fit: cover;
        object-position: ${GROUP_COVER_OBJECT_POSITION};
    }
`;

export { CoverGradient, CoverWrapper, GroupCoverImage };
