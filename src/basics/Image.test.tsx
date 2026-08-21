import { expect, test, vi } from 'vitest';

import { fireEvent, render, screen } from '@testing-library/react';

import Image from './Image';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

test('shows a skeleton until the image loads and calls onLoad', () => {
    const onLoad = vi.fn();

    render(<Image src="cover-one.webp" alt="Cover" onLoad={onLoad} />);

    const image = screen.getByAltText('Cover');
    expect(image.getAttribute('aria-hidden')).toBe('true');

    fireEvent.load(image);

    expect(screen.getByAltText('Cover').getAttribute('aria-hidden')).toBeNull();
    expect(onLoad).toHaveBeenCalledOnce();
});

test('shows the fallback after an error and calls onError', () => {
    const onError = vi.fn();

    render(<Image src="broken.webp" alt="Cover" onError={onError} />);
    fireEvent.error(screen.getByAltText('Cover'));

    expect(screen.queryByAltText('Cover')).toBeNull();
    expect(screen.getByText('media.noImage')).toBeTruthy();
    expect(onError).toHaveBeenCalledOnce();
});

test('starts a new loading cycle when src changes', () => {
    const { rerender } = render(<Image src="cover-one.webp" alt="Cover one" />);

    const firstImage = screen.getByAltText('Cover one');
    fireEvent.load(firstImage);
    expect(screen.getByAltText('Cover one').getAttribute('aria-hidden')).toBeNull();

    rerender(<Image src="cover-two.webp" alt="Cover two" />);

    const secondImage = screen.getByAltText('Cover two');
    expect(secondImage.getAttribute('aria-hidden')).toBe('true');
    expect(secondImage.getAttribute('src')).toBe('cover-two.webp');
});

test('starts a new loading cycle when src returns to an earlier value', () => {
    const { rerender } = render(<Image src="cover-one.webp" alt="Cover one" />);

    fireEvent.load(screen.getByAltText('Cover one'));
    rerender(<Image src="cover-two.webp" alt="Cover two" />);
    rerender(<Image src="cover-one.webp" alt="Cover one" />);

    expect(screen.getByAltText('Cover one').getAttribute('aria-hidden')).toBe('true');
});

test('shows the fallback immediately when src is missing', () => {
    render(<Image alt="Cover" />);

    expect(screen.queryByAltText('Cover')).toBeNull();
    expect(screen.getByText('media.noImage')).toBeTruthy();
});
