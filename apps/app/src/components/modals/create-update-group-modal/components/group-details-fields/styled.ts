import { Button } from '@radix-ui/themes';
import styled, { css } from 'styled-components';

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
