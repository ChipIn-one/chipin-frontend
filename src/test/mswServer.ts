import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll } from 'vitest';

/**
 * An msw (v2) server for one test file: requests without a handler fail the test; handlers added
 * with `server.use(...)` are reset after each test.
 */
export const setupMswServer = (): ReturnType<typeof setupServer> => {
    const server = setupServer();

    beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
    afterEach(() => server.resetHandlers());
    afterAll(() => server.close());

    return server;
};
