import styled from 'styled-components';

import { interactiveCardLinkStyles } from 'helpers/interactiveCardStyles';

import { NavButton } from 'basics/buttons';

const ActivityEventLink = styled(NavButton)`
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

export { ActivityEventLink };
