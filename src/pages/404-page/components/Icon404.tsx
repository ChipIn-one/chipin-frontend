import { LucideFile, LucideFrown, LucideSearch } from 'lucide-react';

const Icon404 = () => (
    <div style={{ position: 'relative', width: 128, height: 128 }}>
        <LucideFile
            size={128}
            strokeWidth={1}
            color="var(--gray-10)"
            style={{ position: 'absolute', top: 0, left: 0 }}
        />
        <LucideFrown
            size={48}
            strokeWidth={2}
            color="var(--gray-10)"
            style={{ position: 'absolute', top: 48, left: 40 }}
        />
        <LucideSearch
            size={64}
            strokeWidth={2}
            color="var(--green-9)"
            style={{ position: 'absolute', bottom: -16, right: -10 }}
        />
    </div>
);

export default Icon404;
