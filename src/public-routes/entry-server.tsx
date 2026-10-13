import { renderToString } from 'react-dom/server';
import { createInstance } from 'i18next';
import { ServerStyleSheet } from 'styled-components';

import type { PublicRoute } from 'constants/publicRoutes';
import { resources } from 'i18n/resources';

import { PublicApp } from './PublicApp';

const renderPublicRoute = (route: PublicRoute): { html: string; styles: string } => {
    const i18n = createInstance();
    i18n.init({
        resources,
        lng: route.locale,
        fallbackLng: 'en',
        defaultNS: 'common',
        initAsync: false,
        interpolation: { escapeValue: false },
    });

    const sheet = new ServerStyleSheet();
    try {
        const html = renderToString(
            sheet.collectStyles(
                <PublicApp route={route} i18nInstance={i18n} server />,
            ),
        );
        return { html, styles: sheet.getStyleTags() };
    } finally {
        sheet.seal();
    }
};

export { renderPublicRoute };
