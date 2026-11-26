import { ScrollArea } from '@radix-ui/themes';
import type { CSSProperties, ReactNode } from 'react';

import styles from './OverlayBody.module.css';

interface Props {
    children: ReactNode;
    fillHeight?: boolean;
    maxHeight?: string;
}

// `maxHeight` is any CSS length, so it reaches the module as a local custom property.
type MaxHeightStyle = CSSProperties & Record<'--_max-height', string>;

const OverlayBody = ({ children, fillHeight = false, maxHeight }: Props) => {
    const hasMaxHeight = maxHeight !== undefined;
    const maxHeightStyle: MaxHeightStyle | undefined = hasMaxHeight
        ? { '--_max-height': maxHeight }
        : undefined;

    return (
        <ScrollArea
            className={styles.root}
            style={maxHeightStyle}
            type="auto"
            scrollbars="vertical"
            data-max-height={hasMaxHeight}
            data-fill-height={fillHeight}
        >
            <div className={styles.content} data-fill-height={fillHeight}>
                {children}
            </div>
        </ScrollArea>
    );
};

export { OverlayBody };
