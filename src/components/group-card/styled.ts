import styled from 'styled-components';

import { Card } from '@radix-ui/themes';

import { themeColor } from 'helpers/colors';
import { interactiveCardLinkStyles } from 'helpers/interactiveCardStyles';

import { NavButton } from 'basics/buttons';

const GroupNavButton = styled(NavButton)`
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

const GroupCardSurface = styled(Card)`
    position: relative;
    overflow: hidden;

    &&[data-selected='true'] {
        outline-style: solid;
        outline-width: 2px;
        outline-color: ${themeColor('grass9')};
        outline-offset: -2px;
    }
`;

export {
    GroupCardSurface,
    GroupNavButton,
};
