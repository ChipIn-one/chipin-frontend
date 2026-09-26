import type { ComponentPropsWithoutRef, MouseEvent } from 'react';
import type { To } from 'react-router-dom';
import styled from 'styled-components';

import { Button } from '@radix-ui/themes';

import { useAppNavigate } from 'hooks/useAppNavigate';

const UnstyledButton = styled(Button)`
    all: unset;
    display: inline-flex;
    cursor: pointer;
    box-sizing: border-box;
    position: relative;
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
