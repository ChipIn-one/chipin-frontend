import { Flex, Separator } from '@radix-ui/themes';
import type { ReactNode } from 'react';

import styles from './OverlayHeader.module.css';

interface Props {
    title: ReactNode;
    closeControl?: ReactNode;
    backControl?: ReactNode;
}

const OverlayHeader = ({ title, closeControl, backControl }: Props) => {
    return (
        <div className={styles.root}>
            <div className={styles.header}>
                {backControl ? (
                    <Flex align="center" gap="3" minWidth="0" flexGrow="1">
                        {backControl}
                        {title}
                    </Flex>
                ) : (
                    title
                )}
                {closeControl}
            </div>
            <Separator orientation="horizontal" size="4" />
        </div>
    );
};

export { OverlayHeader };
