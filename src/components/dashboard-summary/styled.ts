import styled from 'styled-components';

import { Card } from '@radix-ui/themes';

import { themeColor } from 'helpers/colors';

const SummaryCard = styled(Card)`
    transition:
        background-color 120ms ease,
        box-shadow 120ms ease,
        transform 120ms ease;

    &:has(> summary:hover) {
        background-color: ${themeColor('grayA3')};
        box-shadow: inset 0 0 0 1px ${themeColor('grayA6')};
        transform: translateY(-1px);
    }

    &:has(> summary:focus-visible) {
        box-shadow:
            inset 0 0 0 1px ${themeColor('grayA6')},
            0 0 0 2px ${themeColor('grassA8')};
    }
`;

const SummaryToggle = styled.summary`
    display: block;
    list-style: none;
    cursor: pointer;
    outline: none;

    &::-webkit-details-marker {
        display: none;
    }
`;

export { SummaryCard, SummaryToggle };
