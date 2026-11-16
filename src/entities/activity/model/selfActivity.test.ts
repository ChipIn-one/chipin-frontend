import { expect, test } from 'vitest';

import { domainPreview } from 'test/activityFixtures';

import { firstPageOnly, loadedActivityEvents, loadedActivityPreviews } from './selfActivity';

const event = (id: string) => domainPreview(id).parent;

test('lists the previews of every loaded page in order and leaves invalid items out', () => {
    expect(
        loadedActivityPreviews({
            pages: [
                { items: [domainPreview('a'), { kind: 'invalid', id: 'x' }], nextCursor: 40 },
                { items: [domainPreview('b')], nextCursor: null },
            ],
        }),
    ).toEqual([domainPreview('a'), domainPreview('b')]);
    expect(loadedActivityPreviews(undefined)).toEqual([]);
});

test('lists each event of the loaded pages once, in order, and leaves invalid items out', () => {
    expect(
        loadedActivityEvents({
            pages: [
                { items: [event('a'), event('b')], nextCursor: 40 },
                // A new event shifted the feed: the next page repeats `b`.
                { items: [event('b'), { kind: 'invalid', id: 'x' }, event('c')], nextCursor: null },
            ],
        }),
    ).toEqual([event('a'), event('b'), event('c')]);
    expect(loadedActivityEvents(undefined)).toEqual([]);
});

test('cuts loaded pages to the first one with its page param', () => {
    expect(firstPageOnly({ pages: ['p1', 'p2', 'p3'], pageParams: [null, 40, 30] })).toEqual({
        pages: ['p1'],
        pageParams: [null],
    });
});
