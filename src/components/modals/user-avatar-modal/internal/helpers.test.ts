import { describe, expect, test } from 'vitest';

import { validateAvatarFile } from './helpers';

const FIVE_MEBIBYTES = 5 * 1024 * 1024;

const createImageFile = (type: string, size: number) => {
    const file = new File(['avatar'], 'avatar', { type });

    Object.defineProperty(file, 'size', { value: size });

    return file;
};

describe('validateAvatarFile', () => {
    test.each(['image/jpeg', 'image/png', 'image/webp'])(
        'accepts a supported %s image at the size limit',
        type => {
            expect(validateAvatarFile(createImageFile(type, FIVE_MEBIBYTES))).toBeNull();
        },
    );

    test('rejects an unsupported image type', () => {
        expect(validateAvatarFile(createImageFile('image/gif', 1024))).toBe('unsupportedType');
    });

    test('rejects an image above the size limit', () => {
        expect(validateAvatarFile(createImageFile('image/jpeg', FIVE_MEBIBYTES + 1))).toBe(
            'tooLarge',
        );
    });
});
