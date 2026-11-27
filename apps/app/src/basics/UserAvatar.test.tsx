// Issue #946: the avatar always has a text alternative (the user's name, photo or fallback), or is
// explicitly decorative next to a visible name.
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import { UserAvatar } from './UserAvatar';

// jsdom never loads images: this `Image` reports every photo as already loaded, so Radix renders
// the `<img>` instead of the fallback.
class LoadedImage extends EventTarget {
    src = '';
    complete = true;
    naturalWidth = 1;
    referrerPolicy = '';
    crossOrigin: string | null = null;
}

afterEach(() => {
    vi.unstubAllGlobals();
});

const misha = { displayName: 'Misha', picture: 'https://example.com/misha.webp' };

test('names the avatar with the user display name when the photo loads', () => {
    vi.stubGlobal('Image', LoadedImage);

    const { container } = render(<UserAvatar user={misha} />);

    const avatar = screen.getByRole('img', { name: 'Misha' });

    // `asChild` keeps the Radix styling root on the named span.
    expect(avatar.className).toContain('rt-AvatarRoot');
    expect(avatar.className).toContain('rt-r-size-3');
    expect(avatar.dataset.accentColor).toBe('mint');
    // The photo sits inside the named root and adds no second name.
    expect(container.querySelector('img')?.getAttribute('src')).toBe(misha.picture);
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('');
});

test('names the avatar with the display name, not the letter, when the fallback shows', async () => {
    render(<UserAvatar user={{ displayName: 'Misha', picture: null }} />);

    const avatar = screen.getByRole('img', { name: 'Misha' });

    // Radix shows the fallback a tick after the image fails.
    await waitFor(() => expect(avatar.textContent).toBe('M'));
    expect(screen.queryByRole('img', { name: 'M' })).toBeNull();
});

test('a caller alt overrides the display name', () => {
    render(<UserAvatar user={{ displayName: 'Misha' }} alt="Performed by Misha" />);

    expect(screen.getByRole('img', { name: 'Performed by Misha' })).toBeTruthy();
});

test('a decorative avatar is hidden from assistive technology', async () => {
    const { container } = render(<UserAvatar user={{ displayName: 'Misha' }} decorative />);

    await waitFor(() =>
        expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe('M'),
    );
    expect(screen.queryByRole('img')).toBeNull();
});

test('an avatar without a user has no name to announce and is hidden', () => {
    const { container } = render(<UserAvatar />);

    expect(screen.queryByRole('img')).toBeNull();
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
});
