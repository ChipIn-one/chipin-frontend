import type { DefaultTheme } from 'styled-components';
import { css } from 'styled-components';

import { themeColor } from 'helpers/colors';

type ThemeColorToken = keyof DefaultTheme['colors'];

interface InteractiveCardStateOptions {
    backgroundColorToken: ThemeColorToken;
    borderColorToken: ThemeColorToken;
}

interface InteractiveCardFocusOptions {
    borderColorToken: ThemeColorToken;
    focusColorToken: ThemeColorToken;
}

interface InteractiveCardVariant {
    state: InteractiveCardStateOptions;
    hover: InteractiveCardStateOptions;
    focus: InteractiveCardFocusOptions;
}

interface InteractiveCardLinkStylesOptions {
    hover: InteractiveCardStateOptions;
    focus: InteractiveCardFocusOptions;
    selected?: InteractiveCardVariant;
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
}: InteractiveCardStateOptions) => css`
    background-color: ${themeColor(backgroundColorToken)};
    box-shadow: inset 0 0 0 1px ${themeColor(borderColorToken)};
`;

const hover = (options: InteractiveCardStateOptions) => css`
    ${state(options)}
    transform: translateY(-1px);
`;

const focus = ({
    borderColorToken,
    focusColorToken,
}: InteractiveCardFocusOptions) => css`
    box-shadow:
        inset 0 0 0 1px ${themeColor(borderColorToken)},
        0 0 0 2px ${themeColor(focusColorToken)};
`;

const interactiveCardLinkStyles = ({
    hover: hoverOptions,
    focus: focusOptions,
    selected,
}: InteractiveCardLinkStylesOptions) => css`
    display: block;
    width: 100%;

    & [data-interactive-card] {
        ${transition}
    }

    &:hover [data-interactive-card] {
        ${hover(hoverOptions)}
    }

    &:focus-visible [data-interactive-card] {
        ${focus(focusOptions)}
    }

    ${selected &&
    css`
        &[aria-current='page'] [data-interactive-card] {
            ${state(selected.state)}
        }

        &[aria-current='page']:hover [data-interactive-card] {
            ${hover(selected.hover)}
        }

        &[aria-current='page']:focus-visible [data-interactive-card] {
            ${focus(selected.focus)}
        }
    `}
`;

export { interactiveCardLinkStyles };
