import { FileIcon, FrownIcon, SearchIcon } from 'lucide-react';

import styles from './Icon404.module.css';

const Icon404 = () => (
    <div className={styles.root}>
        <FileIcon size={128} strokeWidth={1} color="var(--cp-text-muted)" className={styles.file} />
        <FrownIcon
            size={48}
            strokeWidth={2}
            color="var(--cp-text-muted)"
            className={styles.frown}
        />
        <SearchIcon size={64} strokeWidth={2} color="var(--green-9)" className={styles.search} />
    </div>
);

export { Icon404 };
