import { useRouteError } from 'react-router-dom';

/**
 * The temporary root `errorElement` until 04-2a3 replaces it with `RootErrorBoundary` (spec 04
 * §2.5). Without one, React Router shows its default "Unexpected Application Error!" page and only
 * logs the error. Rethrowing from the error element escapes the router's boundary (an error thrown
 * while a boundary renders its own error UI goes to the boundary above it), so a failed route chunk
 * or a render error reaches `GlobalErrorBoundary` (Sentry and the reload card) as before.
 */
const RethrowRouteError = () => {
    throw useRouteError();
};

export { RethrowRouteError };
