import { Button } from '@radix-ui/themes';
import type { ComponentProps, ComponentPropsWithoutRef, MouseEvent } from 'react';
import type { To } from 'react-router-dom';

import { cx } from 'helpers/cx';
import { useAppNavigate } from 'hooks/useAppNavigate';

import styles from './NavButton.module.css';

// Also the base of a plain `<a href>` that looks like the unstyled NavButton (`asChild`).
export const UnstyledButton = ({ className, ...props }: ComponentProps<typeof Button>) => (
    <Button className={cx(styles.root, className)} {...props} />
);

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
