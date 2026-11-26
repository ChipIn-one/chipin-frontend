import { Separator } from '@radix-ui/themes';
import type { ReactNode } from 'react';

import styles from './OverlayFooter.module.css';

interface Props {
    cancelAction: ReactNode;
    primaryAction: ReactNode;
}

const OverlayFooter = ({ cancelAction, primaryAction }: Props) => {
    return (
        <div className={styles.root}>
            <Separator className={styles.separator} orientation="horizontal" size="4" />
            <div className={styles.footer}>
                {cancelAction}
                {primaryAction}
            </div>
        </div>
    );
};

export { OverlayFooter };
