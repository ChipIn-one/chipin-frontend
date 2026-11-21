import { RADIX_THEME } from '@chipin/tokens/theme';
import { Theme } from '@radix-ui/themes';
import type { ReactNode } from 'react';

interface AppThemeProps {
    /** The resolved appearance; the caller reads it from `appearanceStore` (spec 05 §1). */
    appearance: 'light' | 'dark';
    children: ReactNode;
}

/** The only place where Radix `<Theme>` is configured (spec 05 §1). */
export const AppTheme = ({ appearance, children }: AppThemeProps) => (
    <Theme {...RADIX_THEME} appearance={appearance} hasBackground>
        {children}
    </Theme>
);
