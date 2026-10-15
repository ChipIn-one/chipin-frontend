import { LucideMenu } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { IconButton } from '@radix-ui/themes';

import { matchLocale, SUPPORTED_LOCALES } from 'helpers/locale';

import Dropdown from 'components/Dropdown';

import { LANDING_NAV_LINKS } from './internal/constants';
import type { LandingLanguageProps } from './internal/types';

const LandingMobileMenu = ({ value, onChange }: LandingLanguageProps) => {
    const { t } = useTranslation('landing');
    const { t: tSettings } = useTranslation('settings');

    const navItems = LANDING_NAV_LINKS.map(({ labelKey, href }) => ({
        value: href,
        label: t(labelKey),
        onSelect: () => {
            window.location.href = href;
        },
    }));
    const languageItems = SUPPORTED_LOCALES.map(locale => ({
        value: locale,
        label: tSettings(`language.options.${locale}`),
    }));

    return (
        <Dropdown
            sections={[
                { items: navItems },
                {
                    label: tSettings('common:fields.interfaceLanguage'),
                    items: languageItems,
                    value,
                    onValueChange: nextValue => {
                        const locale = matchLocale(nextValue);

                        if (locale) {
                            onChange(locale);
                        }
                    },
                },
            ]}
            trigger={
                <IconButton variant="ghost" color="gray" size="2">
                    <LucideMenu />
                </IconButton>
            }
            align="end"
        />
    );
};

export { LandingMobileMenu };
