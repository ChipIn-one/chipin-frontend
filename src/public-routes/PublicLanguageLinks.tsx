import { GlobeIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';
import type { PublicRoute } from 'types/publicRoutes';

import { Link } from '@radix-ui/themes';

import { PUBLIC_ROUTE_ENTRIES } from 'constants/publicRouteManifest';
import { themeColor } from 'helpers/colors';
import { suppressPublicLocaleSuggestion } from 'helpers/publicLocaleSuggestion';
import { getPublicPath } from 'helpers/publicRoutes';

// Native details with real links preserve no-JS navigation on SSG pages.
// After hydration the header's searchable selector replaces this fallback.
const LanguageMenu = styled.details`
    position: relative;
    z-index: 2;
    width: max-content;
    margin: 8px 16px 8px auto;
`;

const LanguageTrigger = styled.summary`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    cursor: pointer;
    list-style: none;
    color: ${themeColor('gray12')};

    &::-webkit-details-marker {
        display: none;
    }
`;

const LanguageOptions = styled.nav`
    position: absolute;
    inset-inline-end: 0;
    top: 100%;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: max-content;
    padding: 12px;
    border: 1px solid ${themeColor('gray6')};
    border-radius: 8px;
    background: ${themeColor('gray2')};
`;

const PublicLanguageLinks = ({ route }: { route: PublicRoute }) => {
    const { t } = useTranslation('settings');

    return (
        <LanguageMenu>
            <LanguageTrigger>
                <GlobeIcon size={18} aria-hidden />
                {t('common:fields.interfaceLanguage')}
            </LanguageTrigger>
            <LanguageOptions aria-label={t('common:fields.interfaceLanguage')}>
                {PUBLIC_ROUTE_ENTRIES
                    .filter(item => item.page === route.page)
                    .map(item => (
                        <Link
                            href={getPublicPath(item.page, item.locale)}
                            onClick={suppressPublicLocaleSuggestion}
                            key={item.locale}
                            lang={item.locale}
                            size="2"
                            underline={item.locale === route.locale ? 'always' : 'hover'}
                            aria-current={item.locale === route.locale ? 'page' : undefined}
                        >
                            {t(`language.options.${item.locale}`)}
                        </Link>
                    ))}
            </LanguageOptions>
        </LanguageMenu>
    );
};

export { PublicLanguageLinks };
