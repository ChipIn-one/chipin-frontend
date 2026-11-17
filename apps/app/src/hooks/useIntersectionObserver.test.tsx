import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { getOrThrow } from 'test/getOrThrow';

import { useIntersectionObserver } from './useIntersectionObserver';

type ObserverCallback = (entries: IntersectionObserverEntry[]) => void;

const observers: {
    callback: ObserverCallback;
    options: IntersectionObserverInit | undefined;
    observe: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
}[] = [];

class IntersectionObserverMock {
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
    takeRecords = vi.fn(() => []);

    constructor(callback: ObserverCallback, options?: IntersectionObserverInit) {
        observers.push({
            callback,
            options,
            observe: this.observe,
            disconnect: this.disconnect,
        });
    }
}

const Sentinel = ({ visible = true }: { visible?: boolean }) => {
    const [ref, entry] = useIntersectionObserver({ threshold: 0 });

    return (
        <>
            {visible && <div ref={ref} data-testid="sentinel" />}
            <span>{entry === null ? 'none' : String(entry.isIntersecting)}</span>
        </>
    );
};

beforeEach(() => {
    observers.length = 0;
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

test('observes the attached element and exposes the latest entry', () => {
    render(<Sentinel />);

    expect(observers).toHaveLength(1);
    expect(getOrThrow(observers, 0).observe).toHaveBeenCalledWith(screen.getByTestId('sentinel'));
    expect(getOrThrow(observers, 0).options?.threshold).toEqual([0]);
    expect(screen.getByText('none')).toBeTruthy();

    act(() => {
        getOrThrow(observers, 0).callback([{ isIntersecting: true } as IntersectionObserverEntry]);
    });

    expect(screen.getByText('true')).toBeTruthy();
});

test('disconnects when the element is detached or the component unmounts', () => {
    const { rerender, unmount } = render(<Sentinel />);

    rerender(<Sentinel visible={false} />);

    expect(getOrThrow(observers, 0).disconnect).toHaveBeenCalledOnce();

    rerender(<Sentinel />);
    unmount();

    expect(observers).toHaveLength(2);
    expect(getOrThrow(observers, 1).disconnect).toHaveBeenCalledOnce();
});
