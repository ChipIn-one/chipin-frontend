import styled from 'styled-components';

import { Card } from '@radix-ui/themes';

import { themeColor } from 'helpers/colors';

const CtaCard = styled(Card)`
    background: radial-gradient(
        circle at 50% -10%,
        ${themeColor('green5')} 0%,
        ${themeColor('green2')} 55%
    );
    padding: var(--space-8);
    overflow: hidden;
`;

export { CtaCard };
