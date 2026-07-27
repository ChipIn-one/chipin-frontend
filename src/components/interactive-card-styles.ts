import type { DefaultTheme } from 'styled-components';
import { css } from 'styled-components';

import { themeColor } from 'helpers/colors';

type ThemeColorToken = keyof DefaultTheme['colors'];

interface InteractiveCardStylesOptions {
    backgroundColorToken: ThemeColorToken;
    borderColorToken: ThemeColorToken;
}

interface InteractiveCardFocusStylesOptions {
    borderColorToken: ThemeColorToken;
    focusColorToken: ThemeColorToken;
}

const transition = css`
    transition:
        background-color 120ms ease,
        box-shadow 120ms ease,
        transform 120ms ease;
`;

const state = ({
    backgroundColorToken,
    borderColorToken,
}: InteractiveCardStylesOptions) => css`
    background-color: ${themeColor(backgroundColorToken)};
    box-shadow: inset 0 0 0 1px ${themeColor(borderColorToken)};
`;

const hover = (options: InteractiveCardStylesOptions) => css`
    ${state(options)}
    transform: translateY(-1px);
`;

const focus = ({
    borderColorToken,
    focusColorToken,
}: InteractiveCardFocusStylesOptions) => css`
    box-shadow:
        inset 0 0 0 1px ${themeColor(borderColorToken)},
        0 0 0 2px ${themeColor(focusColorToken)};
`;

export const interactiveCardStyles = {
    focus,
    hover,
    state,
    transition,
};
