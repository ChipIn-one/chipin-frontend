/* eslint-disable simple-import-sort/imports */
import Main from 'main';
import { ThemeProvider } from 'next-themes';
import { createRoot } from 'react-dom/client';
import 'i18n';

import '@radix-ui/themes/styles.css';
import 'styles/radixStylesOverwrite.css';

import 'i18n';
import 'constants/globals';

createRoot(document.getElementById('root')!).render(
    <ThemeProvider attribute="class" enableSystem>
        <Main />
    </ThemeProvider>,
);
