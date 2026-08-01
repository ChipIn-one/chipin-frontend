import styled, { css } from 'styled-components';

import { themeColor } from 'helpers/colors';

import Logotype from 'assets/logo.svg?react';

const StyledModeLogotype = styled(Logotype)<{ $isSoloMode: boolean }>`
    width: 40px;
    height: 40px;

    ${({ $isSoloMode }) =>
        $isSoloMode &&
        css`
            --logo-primary-color: ${themeColor('violet9')};
            --logo-secondary-color: ${themeColor('violet11')};
        `}
`;

export { StyledModeLogotype };
