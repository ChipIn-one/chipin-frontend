import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

import { getPublicRoute } from 'constants/publicRoutes';

import { updateSeoMetadata } from './seoMetadata';

/**
 * Title, description and SEO tags of the transitional public routes only (until 04-5a). The title of
 * the app routes is `useDocumentTitle` in `RootLayout` (spec 04 §2.6, from `handle.meta`); here an
 * app route only gets the noindex tags and no description.
 */
export const useRoutesMeta = () => {
    const { pathname } = useLocation();
    const { i18n, t } = useTranslation('meta');

    useEffect(() => {
        const publicRoute = getPublicRoute(pathname);

        if (!publicRoute) {
            document.querySelector('meta[name="description"]')?.remove();
            updateSeoMetadata(pathname, '', '');
            return;
        }

        const title = t(`${publicRoute.metaKey}.title`);
        const description = t(`${publicRoute.metaKey}.description`);
        document.title = title;

        let element = document.querySelector<HTMLMetaElement>('meta[name="description"]');

        if (!element) {
            element = document.createElement('meta');
            element.setAttribute('name', 'description');
            document.head.appendChild(element);
        }

        element.setAttribute('content', description);

        updateSeoMetadata(pathname, title, description);
    }, [i18n.resolvedLanguage, pathname, t]);
};
