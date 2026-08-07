import styled from 'styled-components';

import { Box } from '@radix-ui/themes';

import { MEDIA_QUERIES } from 'constants/breakpoints';

const GroupCoverBox = styled(Box)`
    @media ${MEDIA_QUERIES.belowSm} {
        margin-top: calc(-1 * var(--space-4));
        margin-right: calc(-1 * var(--space-4));
        margin-left: calc(-1 * var(--space-4));
    }
`;

export { GroupCoverBox };
