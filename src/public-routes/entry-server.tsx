import { createInstance } from 'i18next';
import { renderToString } from 'react-dom/server';
import { ServerStyleSheet } from 'styled-components';

import { DEFAULT_LOCALE } from 'constants/locales';
import { resources } from 'i18n/resources';
import type { PublicRoute } from 'types/publicRoutes';

import { PublicApp } from './PublicApp';
import { PublicBuildYearContext } from './PublicBuildYearContext';

const renderPublicRoute = (
    route: PublicRoute,
): { html: string; styles: string; buildYear: number } => {
    const buildYear = new Date().getFullYear();
    const i18n = createInstance();
    void i18n.init({
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
