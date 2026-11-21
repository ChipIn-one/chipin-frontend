import { Button } from '@radix-ui/themes';
import type { ComponentPropsWithoutRef, MouseEvent } from 'react';
import type { To } from 'react-router-dom';
import styled from 'styled-components';

import { themeColor } from 'helpers/colors';
import { useAppNavigate } from 'hooks/useAppNavigate';

// Also the base of a plain `<a href>` that looks like the unstyled NavButton (`asChild`).
export const UnstyledButton = styled(Button)`
    all: unset;
    display: inline-flex;
    cursor: pointer;
    box-sizing: border-box;
    position: relative;

    &:focus-visible {
        outline: 2px solid var(--cp-focus-ring, ${themeColor('grassA8')});
        outline-offset: 2px;
    }
`;

interface NavButtonProps extends ComponentPropsWithoutRef<typeof Button> {
    to: To;
    replace?: boolean;
    state?: unknown;
    unsetStyles?: boolean;
}

export const NavButton = ({
    to,
    replace,
    state,
    unsetStyles,
    onClick,
    ...props
}: NavButtonProps) => {
    const navigate = useAppNavigate();

    const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
        onClick?.(e);
        navigate(to, { replace, state });
    };

    const Root = unsetStyles ? UnstyledButton : Button;

    return <Root role="link" onClick={handleClick} {...props} />;
};
