import type { ComponentPropsWithoutRef } from 'react';

import { cx } from 'helpers/cx';

import { NavButton } from 'components/NavButton';

import styles from './InteractiveCard.module.css';

type Props = Omit<ComponentPropsWithoutRef<typeof NavButton>, 'unsetStyles'>;

/**
 * A whole card as a link (spec 05 §3, §4): an unstyled `NavButton` around the caller's Radix
 * `Card`, which carries `data-interactive-card` and draws the hover, pressed and focus states.
 */
const InteractiveCard = ({ className, ...props }: Props) => (
    <NavButton {...props} unsetStyles className={cx(styles.root, className)} />
);

export { InteractiveCard };
