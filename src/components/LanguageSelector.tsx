import { LucideChevronDown, LucideGlobe } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button, Flex, IconButton, Text } from '@radix-ui/themes';

import {
    matchLocale,
    SUPPORTED_LOCALES,
    type SupportedLocale,
} from 'helpers/locale';

import { SearchSelect } from 'components/search-select';

type LanguageSelectorVariant = 'compact' | 'full';

interface Props {
    value: SupportedLocale;
    onChange: (locale: SupportedLocale) => void;
    variant?: LanguageSelectorVariant;
    isLoading?: boolean;
}

const LanguageSelector = ({
    value,
    onChange,
    variant = 'full',
    isLoading = false,
}: Props) => {
    const { t } = useTranslation('settings');

    const items = SUPPORTED_LOCALES.map(locale => ({
        value: locale,
        label: t(`language.options.${locale}`),
        searchFields: [locale, t(`language.options.${locale}`)],
    }));

    const onValueChange = (nextValue: string) => {
        const locale = matchLocale(nextValue);

        if (locale) {
            onChange(locale);
        }
    };

    const isCompact = variant === 'compact';
    const triggerElement = isCompact ? (
        <IconButton
            type="button"
            variant="ghost"
            color="gray"
            size="2"
            aria-label={t('common:fields.interfaceLanguage')}
        >
            <LucideGlobe size={18} />
        </IconButton>
    ) : (
        <Button
            type="button"
            variant="surface"
            color="gray"
            size="3"
            radius="large"
            loading={isLoading}
        >
            <Flex align="center" justify="between" gap="2" width="100%">
                <Text truncate>{t(`language.options.${value}`)}</Text>
                <LucideChevronDown size={16} />
            </Flex>
        </Button>
    );

    return (
        <SearchSelect
            items={items}
            value={value}
            searchPlaceholder={t('regional.languageSearchPlaceholder')}
            emptyText={t('regional.languageSearchEmpty')}
            triggerElement={triggerElement}
            triggerWidth={isCompact ? 'content' : 'full'}
            contentWidth={isCompact ? 'content' : 'trigger'}
            contentMinWidth={isCompact ? '14rem' : undefined}
            onChange={onValueChange}
        />
    );
};

export default LanguageSelector;
