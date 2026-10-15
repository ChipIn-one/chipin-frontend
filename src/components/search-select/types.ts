import type { ReactNode } from 'react';

interface SearchSelectItem {
    value: string;
    label: string;
    icon?: ReactNode;
    isIndented?: boolean;
    searchFields?: string[];
    href?: string;
    lang?: string;
    onNavigate?: () => void;
}

export type { SearchSelectItem };
