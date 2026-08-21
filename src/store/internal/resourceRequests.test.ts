import { expect, test, vi } from 'vitest';

import { createRequestChannel } from './resourceRequests';

test('reuses a pending request for the same identity', () => {
    const channel = createRequestChannel();
    const loader = vi.fn().mockResolvedValue('confirmed');

    const first = channel.request(loader);
    const second = channel.request(loader);

    expect(loader).toHaveBeenCalledOnce();
    expect(second.promise).toBe(first.promise);

    return first.promise.then(value => {
        expect(value).toBe('confirmed');
    });
});

test('aborts the pending request when a forced request replaces it', () => {
    const channel = createRequestChannel();
    let firstSignal: AbortSignal | undefined;
    let resolveSecond: ((value: string) => void) | undefined;

    const first = channel.request(signal => {
        firstSignal = signal;
        return new Promise<string>(() => undefined);
    });
    const second = channel.request(
        () => new Promise(resolve => {
            resolveSecond = resolve;
        }),
        { force: true },
    );

    expect(firstSignal?.aborted).toBe(true);

    resolveSecond?.('fresh');

    return Promise.all([first.promise, second.promise]).then(([firstValue, secondValue]) => {
        expect(firstValue).toBe('fresh');
        expect(secondValue).toBe('fresh');
    });
});

test('aborts a different view request in the same channel', () => {
    const channel = createRequestChannel();
    let firstSignal: AbortSignal | undefined;

    channel.request(
        signal => {
            firstSignal = signal;
            return new Promise<string>(() => undefined);
        },
        { identity: 'group-1' },
    );
    channel.request(
        () => Promise.resolve('group-2'),
        { identity: 'group-2' },
    );

    expect(firstSignal?.aborted).toBe(true);
});

test('aborts only the channel that is being reset', () => {
    const dashboardChannel = createRequestChannel();
    const friendsChannel = createRequestChannel();
    const signals: AbortSignal[] = [];
    const loader = (signal: AbortSignal) => {
        signals.push(signal);
        return new Promise<void>(() => undefined);
    };

    dashboardChannel.request(loader);
    friendsChannel.request(loader);
    dashboardChannel.abort();

    expect(signals).toHaveLength(2);
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);
});
