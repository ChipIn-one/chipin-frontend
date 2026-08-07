import styled, { css } from 'styled-components';

import { Button } from '@radix-ui/themes';

const DescriptionToggleButton = styled(Button)`
    width: fit-content;
`;

const DescriptionToggleIcon = styled.span<{ $isExpanded: boolean }>`
    display: inline-flex;
    transition: transform 150ms ease;

    ${({ $isExpanded }) =>
        $isExpanded &&
        css`
            transform: rotate(180deg);
        `}
`;

export { DescriptionToggleButton, DescriptionToggleIcon };
