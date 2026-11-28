import { PROP_COLOR } from '@chipin/tokens/theme';
import { Button, Flex, Text } from '@radix-ui/themes';
import { ChevronDownIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { matchLocale, SUPPORTED_LOCALES, type SupportedLocale } from 'helpers/locale';

import { SearchSelect } from 'components/search-select';

interface Props {
    value: SupportedLocale;
    onChange: (locale: SupportedLocale) => void;
    isLoading?: boolean;
}

const LanguageSelector = ({ value, onChange, isLoading = false }: Props) => {
    const { t } = useTranslation('settings');

    const items = SUPPORTED_LOCALES.map(locale => ({
        value: locale,
        label: t(`language.options.${locale}`),
        searchFields: [locale, t(`language.options.${locale}`)],
        lang: locale,
    }));

    const onValueChange = (nextValue: string) => {
        const locale = matchLocale(nextValue);

        if (locale) {
            onChange(locale);
        }
    };

    return (
        <SearchSelect
            items={items}
            value={value}
            searchPlaceholder={t('regional.languageSearchPlaceholder')}
            emptyText={t('regional.languageSearchEmpty')}
            triggerElement={
                <Button
                    type="button"
                    variant="surface"
                    color={PROP_COLOR.neutral}
                    size="3"
                    radius="large"
                    loading={isLoading}
                >
                    <Flex align="center" justify="between" gap="2" width="100%">
                        <Text truncate>{t(`language.options.${value}`)}</Text>
                        <ChevronDownIcon size={16} />
                    </Flex>
                </Button>
            }
            triggerWidth="full"
            contentWidth="trigger"
            onChange={onValueChange}
        />
    );
};

export { LanguageSelector };
