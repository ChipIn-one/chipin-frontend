import type { LoaderFunctionArgs } from 'react-router-dom';
import { RouterContextProvider } from 'react-router-dom';

/** The arguments the router passes to a loader, for calling a loader directly in a test. */
const loaderArgs = (params: LoaderFunctionArgs['params']): LoaderFunctionArgs => ({
    params,
    request: new Request('http://localhost/'),
    url: new URL('http://localhost/'),
    pattern: '/',
    context: new RouterContextProvider(),
});

export { loaderArgs };
