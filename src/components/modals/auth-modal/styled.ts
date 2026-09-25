import { Flex } from '@radix-ui/themes';
import styled from 'styled-components';

import Image from 'basics/Image';
import { MEDIA_QUERIES } from 'constants/breakpoints';

const AuthLayout = styled(Flex)`
    @media ${MEDIA_QUERIES.belowSm} {
        padding-right: env(safe-area-inset-right);
        padding-bottom: env(safe-area-inset-bottom);
        padding-left: env(safe-area-inset-left);
    }
`;

const IllustrationPanel = styled(Flex)`
    max-width: 390px;
    overflow: hidden;
    background:
        radial-gradient(circle at 50% 18%, var(--grass-a5), transparent 58%),
        var(--color-panel-solid);
    border-radius: var(--radius-5);
    box-shadow: var(--shadow-3);

    @media ${MEDIA_QUERIES.belowSm} {
        max-width: 360px;
    }
`;

const SharedExpensesImage = styled(Image)`
    display: block;
    max-width: 100%;
    max-height: 280px;

    @media ${MEDIA_QUERIES.belowSm} {
        max-height: clamp(160px, 28dvh, 250px);
    }
`;

export { AuthLayout, IllustrationPanel, SharedExpensesImage };
