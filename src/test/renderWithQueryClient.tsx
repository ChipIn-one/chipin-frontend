import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { RenderResult } from '@testing-library/react';
import { render } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';

const liveClients = new Set<QueryClient>();
const createdListeners = new Set<(client: QueryClient) => void>();

/** Runs `listener` for every test client created from now on (see `test/selfUserMirror`). */
export const onTestQueryClientCreated = (listener: (client: QueryClient) => void): void => {
    createdListeners.add(listener);
};

/** The test clients of the running test. */
export const liveTestQueryClients = (): ReadonlySet<QueryClient> => liveClients;

/** A new client per test: no retries, nothing garbage-collected while the test runs. */
export const createTestQueryClient = (): QueryClient => {
    const client = new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: Infinity },
            mutations: { retry: false, gcTime: Infinity },
        },
    });

    liveClients.add(client);
    createdListeners.forEach(listener => {
        listener(client);
    });
    return client;
};

let defaultClient: QueryClient | null = null;

/** The client every `render` of a test file runs in unless it brings its own provider. */
export const getDefaultTestQueryClient = (): QueryClient => {
    defaultClient ??= createTestQueryClient();
    return defaultClient;
};

/** After each test: forget the clients, so the next test starts with an empty cache. */
export const resetTestQueryClients = (): void => {
    liveClients.forEach(client => {
        client.clear();
    });
    liveClients.clear();
    defaultClient = null;
};

export const DefaultTestQueryProvider = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={getDefaultTestQueryClient()}>{children}</QueryClientProvider>
);

/** `render()` inside a `QueryClientProvider` with a fresh test client. */
export const renderWithQueryClient = (
    ui: ReactElement,
    client: QueryClient = createTestQueryClient(),
): RenderResult & { client: QueryClient } => ({
    ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>),
    client,
});
