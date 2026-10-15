import { renderToString } from 'react-dom/server';
import { createInstance } from 'i18next';
import { ServerStyleSheet } from 'styled-components';

import type { PublicRoute } from 'types/publicRoutes';
import { DEFAULT_LOCALE } from 'constants/locales';
import { PublicBuildYearContext } from './PublicBuildYearContext';
import { resources } from 'i18n/resources';

import { PublicApp } from './PublicApp';

const renderPublicRoute = (route: PublicRoute): { html: string; styles: string; buildYear: number } => {
    const buildYear = new Date().getFullYear();
    const i18n = createInstance();
    i18n.init({
        resources,
        lng: route.locale,
        fallbackLng: DEFAULT_LOCALE,
        defaultNS: 'common',
        initAsync: false,
        interpolation: { escapeValue: false },
    });

    const sheet = new ServerStyleSheet();
    try {
        const html = renderToString(
            sheet.collectStyles(
                <PublicBuildYearContext.Provider value={buildYear}>
                    <PublicApp route={route} i18nInstance={i18n} server />
                </PublicBuildYearContext.Provider>,
            ),
        );
        return { html, styles: sheet.getStyleTags(), buildYear };
    } finally {
        sheet.seal();
    }
};

export { renderPublicRoute };
