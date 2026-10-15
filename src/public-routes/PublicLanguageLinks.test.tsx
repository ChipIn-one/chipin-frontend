import { renderToString } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import { ThemeProvider } from 'styled-components';
import { expect, test } from 'vitest';

import { lightThemeStyled } from 'constants/styled-themes';
import { PUBLIC_ROUTE_ENTRIES } from 'constants/publicRouteManifest';
import i18n from 'i18n';

import { PublicLanguageLinks } from './PublicLanguageLinks';

test('SSG retains native no-JS language navigation without a visible link row', () => {
    const route = PUBLIC_ROUTE_ENTRIES.find(item => item.path === '/privacy')!;
    const markup = renderToString(
        <I18nextProvider i18n={i18n}>
            <ThemeProvider theme={lightThemeStyled}>
                <PublicLanguageLinks route={route} />
            </ThemeProvider>
        </I18nextProvider>,
    );

    expect(markup).toContain('<details');
    expect(markup).toContain('<summary');
    expect(markup).toContain('href="/privacy"');
    expect(markup).toContain('href="/ru/privacy"');
    expect(markup).toContain('href="/pt-br/privacy"');
    expect(markup).toContain('href="/pt-pt/privacy"');
});
