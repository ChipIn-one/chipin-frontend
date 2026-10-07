import styled from 'styled-components';

import { Button, Card } from '@radix-ui/themes';

import { interactiveCardLinkStyles } from 'helpers/interactiveCardStyles';

const SummaryToggleButton = styled(Button)`
    all: unset;
    display: block;
    width: 100%;
    cursor: pointer;
    box-sizing: border-box;
    position: relative;

    ${interactiveCardLinkStyles({
        hover: {
            backgroundColorToken: 'grayA3',
            borderColorToken: 'grayA6',
        },
        focus: {
            borderColorToken: 'grayA6',
            focusColorToken: 'grassA8',
        },
    })}
`;

const SummaryCardSurface = styled(Card)`
    position: relative;
    overflow: hidden;
`;

export { SummaryCardSurface, SummaryToggleButton };
