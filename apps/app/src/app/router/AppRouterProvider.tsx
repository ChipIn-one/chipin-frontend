import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';

import { createAppRouter } from './createAppRouter';

type AppRouter = ReturnType<typeof createAppRouter>;

/**
 * Disposes a router that no longer renders and makes it inert. React Router's `dispose` only stops
 * listening to the history: the router still runs `navigate`, `fetch` and `revalidate`, and a
 * navigation still writes `window.history`. The unmounted pages of the old tree keep its `navigate`
 * (the OAuth callback awaits the exchange across the remount), so such a write would change the
 * shared address bar behind the live router's back (#835). `useNavigate`, `<Navigate>` and
 * `useSearchParams` read `router.navigate` at call time, so replacing it here silences them;
 * `useSubmit`, `<Form>` and `useFetcher` capture it at render time and are not covered (the app
 * uses none of them).
 */
const disposeRouter = (router: AppRouter) => {
    router.dispose();
    const ignored = (method: 'navigate' | 'fetch' | 'revalidate') => () => {
        // Expected from a page the user remount unmounted; a bug if this router still renders
        // (StrictMode, Fast Refresh), which would otherwise fail silently.
        if (import.meta.env.DEV) {
            console.warn(`${method} on a disposed router is ignored`);
        }
        return Promise.resolve();
    };

    router.navigate = ignored('navigate');
    router.fetch = ignored('fetch');
    router.revalidate = ignored('revalidate');
};

/**
 * One router per query client: `UserQueryProvider` remounts this subtree for another user, and the
 * new router starts from the current URL, as the remounted `BrowserRouter` did. The router is created
 * in a `useState` initializer and disposed (see `disposeRouter`) in an effect cleanup, so a router
 * replaced on a remount never writes the browser history again. That assumes no `StrictMode`: its
 * simulated unmount would dispose a router that stays in use.
 */
const AppRouterProvider = () => {
    const queryClient = useQueryClient();
    const [router] = useState(() => createAppRouter(queryClient));

    useEffect(() => () => disposeRouter(router), [router]);

    return <RouterProvider router={router} />;
};

export { AppRouterProvider };
