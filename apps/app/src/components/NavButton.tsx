import { Button } from '@radix-ui/themes';
import type { ComponentProps, ComponentPropsWithRef } from 'react';
import { Link } from 'react-router-dom';

import { cx } from 'helpers/cx';

import styles from './NavButton.module.css';

// Also the base of a plain `<a href>` that looks like the unstyled NavButton (`asChild`).
export const UnstyledButton = ({ className, ...props }: ComponentProps<typeof Button>) => (
    <Button className={cx(styles.root, className)} {...props} />
);

// The Radix Button props that style the link; everything else belongs to the `<a>` itself.
type ButtonLookProps = Pick<
    ComponentProps<typeof Button>,
    | 'className'
    | 'color'
    | 'variant'
    | 'size'
    | 'radius'
    | 'highContrast'
    | 'm'
    | 'mx'
    | 'my'
    | 'mt'
    | 'mr'
    | 'mb'
    | 'ml'
>;

type NavButtonProps = ButtonLookProps &
    Omit<ComponentPropsWithRef<typeof Link>, keyof ButtonLookProps> & {
        unsetStyles?: boolean;
    };

/**
 * A real `<a href>` (react-router `Link`) dressed as a Radix Button. Link calls the caller's
 * `onClick` first, skips navigation when it is default-prevented, and leaves modifier and
 * middle clicks to the browser (new tab, window or download). A ghost variant gets no
 * font-weight from Radix on an `<a>`, so plain text inside inherits its parent's weight; set
 * `weight` on the text.
 */
export const NavButton = ({
    unsetStyles,
    className,
    color,
    variant,
    size,
    radius,
    highContrast,
    m,
    mx,
    my,
    mt,
    mr,
    mb,
    ml,
    ...linkProps
}: NavButtonProps) => {
    const Root = unsetStyles ? UnstyledButton : Button;

    return (
        <Root
            asChild
            className={className}
            color={color}
            variant={variant}
            size={size}
            radius={radius}
            highContrast={highContrast}
            m={m}
            mx={mx}
            my={my}
            mt={mt}
            mr={mr}
            mb={mb}
            ml={ml}
        >
            <Link {...linkProps} />
        </Root>
    );
};
