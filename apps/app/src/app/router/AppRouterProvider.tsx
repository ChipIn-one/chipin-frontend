import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';

import { createAppRouter } from './createAppRouter';

/**
 * One router per query client: `UserQueryProvider` remounts this subtree for another user, and the
 * new router starts from the current URL, as the remounted `BrowserRouter` did. The router is created
 * in a `useState` initializer and disposed (it stops listening to the history) in an effect cleanup.
 * That assumes no `StrictMode`: its simulated unmount would dispose a router that stays in use.
 */
const AppRouterProvider = () => {
    const queryClient = useQueryClient();
    const [router] = useState(() => createAppRouter(queryClient));

    useEffect(() => () => router.dispose(), [router]);

    return <RouterProvider router={router} />;
};

export { AppRouterProvider };
