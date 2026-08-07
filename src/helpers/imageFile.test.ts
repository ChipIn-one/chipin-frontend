import { describe, expect, test } from 'vitest';

import { validateImageFile } from './imageFile';

const FIVE_MEBIBYTES = 5 * 1024 * 1024;

const createImageFile = (type: string, size: number) => {
    const file = new File(['image'], 'image', { type });

    Object.defineProperty(file, 'size', { value: size });

    return file;
};

describe('validateImageFile', () => {
    test.each(['image/jpeg', 'image/png', 'image/webp'])(
        'accepts a supported %s image at the size limit',
        type => {
            expect(validateImageFile(createImageFile(type, FIVE_MEBIBYTES))).toBeNull();
        },
    );

    test('rejects an unsupported image type', () => {
        expect(validateImageFile(createImageFile('image/gif', 1024))).toBe('unsupportedType');
    });

    test('rejects an image above the size limit', () => {
        expect(validateImageFile(createImageFile('image/jpeg', FIVE_MEBIBYTES + 1))).toBe(
            'tooLarge',
        );
    });
});
