import { expect, test, vi } from 'vitest';

import { renderHook } from '@testing-library/react';

import { useExpenseModalOpenChange } from './hooks';

test('runs the lifecycle callback when the modal is initially open', () => {
    const onOpenChange = vi.fn();

    renderHook(() => useExpenseModalOpenChange(true, onOpenChange));

    expect(onOpenChange).toHaveBeenCalledTimes(1);
});

test('runs the lifecycle callback when the modal opens', () => {
    const onOpenChange = vi.fn();
    const { rerender } = renderHook(
        ({ isOpened }) => useExpenseModalOpenChange(isOpened, onOpenChange),
        { initialProps: { isOpened: false } },
    );

    expect(onOpenChange).not.toHaveBeenCalled();

    rerender({ isOpened: true });

    expect(onOpenChange).toHaveBeenCalledTimes(1);
});

test('does not rerun when only the callback identity changes', () => {
    const firstOnOpenChange = vi.fn();
    const secondOnOpenChange = vi.fn();
    const { rerender } = renderHook(
        ({ onOpenChange }) =>
            useExpenseModalOpenChange(true, onOpenChange),
        { initialProps: { onOpenChange: firstOnOpenChange } },
    );

    rerender({ onOpenChange: secondOnOpenChange });

    expect(firstOnOpenChange).toHaveBeenCalledTimes(1);
    expect(secondOnOpenChange).not.toHaveBeenCalled();
});
