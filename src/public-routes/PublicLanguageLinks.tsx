import { useTranslation } from 'react-i18next';

import { Flex, Link } from '@radix-ui/themes';

import { PUBLIC_ROUTE_ENTRIES } from 'constants/publicRouteManifest';
import { getPublicPath } from 'helpers/publicRoutes';
import { suppressPublicLocaleSuggestion } from 'helpers/publicLocaleSuggestion';
import type { PublicRoute } from 'types/publicRoutes';

const PublicLanguageLinks = ({ route }: { route: PublicRoute }) => {
    const { t } = useTranslation('settings');
    return (
        <Flex px="4" pt="2" gap="3" align="center" wrap="wrap" justify="center">
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
        </Flex>
    );
};

export { PublicLanguageLinks };
