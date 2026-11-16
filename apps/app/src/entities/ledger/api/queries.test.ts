import { dehydrate } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';

import { dehydrateOptions } from 'shared/offline/queryPersister';
import { setupMswServer } from 'test/mswServer';
import { createTestQueryClient } from 'test/renderWithQueryClient';

import { capabilitiesKeys, capabilitiesQueryOptions } from './queries';

const server = setupMswServer();

test("capabilitiesQueryOptions: key ['meta','capabilities'], staleTime 10 min, persisted", async () => {
    server.use(
        http.get('*/health', () =>
            HttpResponse.json({ status: 'UP', capabilities: ['ledger.entryVersion'] }),
        ),
    );
    const client = createTestQueryClient();
    const options = capabilitiesQueryOptions();

    expect(options.queryKey).toEqual(['meta', 'capabilities']);
    expect(options.staleTime).toBe(10 * 60 * 1000);
    await expect(client.fetchQuery(options)).resolves.toEqual(['ledger.entryVersion']);
    expect(dehydrate(client, dehydrateOptions).queries.map(query => query.queryKey)).toEqual([
        capabilitiesKeys.all,
    ]);
});

test('a /health answer without the capabilities field means no capabilities', async () => {
    server.use(http.get('*/health', () => HttpResponse.json({ status: 'UP' })));

    await expect(createTestQueryClient().fetchQuery(capabilitiesQueryOptions())).resolves.toEqual(
        [],
    );
});
