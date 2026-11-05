import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { RenderResult } from '@testing-library/react';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';

/** A new client per test: no retries, nothing garbage-collected while the test runs. */
export const createTestQueryClient = (): QueryClient =>
    new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: Infinity },
            mutations: { retry: false, gcTime: Infinity },
        },
    });

/** `render()` inside a `QueryClientProvider` with a fresh test client. */
export const renderWithQueryClient = (
    ui: ReactElement,
    client: QueryClient = createTestQueryClient(),
): RenderResult & { client: QueryClient } => ({
    ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>),
    client,
});
