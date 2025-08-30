import Main from 'main';
import { ThemeProvider } from 'next-themes';
import { createRoot } from 'react-dom/client';

import '@radix-ui/themes/styles.css';
import 'styles/radixStylesOverwrite.css';

createRoot(document.getElementById('root')!).render(
    <ThemeProvider attribute="class" enableSystem>
        <Main />
    </ThemeProvider>,
);
