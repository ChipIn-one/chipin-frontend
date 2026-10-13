import type { SupportedLocale } from 'helpers/locale';

export interface LandingLanguageProps {
    value: SupportedLocale;
    onChange: (locale: SupportedLocale) => void;
}

