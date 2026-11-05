import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll } from 'vitest';

/**
 * An msw (v2) server for one test file. `onUnhandledRequest: 'error'`: a request without a handler
 * is logged with `console.error` and fails as a network error in the code under test (it is never
 * sent to the real network); that does not fail the test by itself, the test's own expectations
 * do. Handlers added with `server.use(...)` are reset after each test.
 */
export const setupMswServer = (): ReturnType<typeof setupServer> => {
    const server = setupServer();

    beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
    afterEach(() => server.resetHandlers());
    afterAll(() => server.close());

    return server;
};
