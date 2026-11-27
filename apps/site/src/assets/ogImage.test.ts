import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'vitest';

// #940: the social preview BaseLayout links on every page (og:image, twitter:image). Social
// networks expect 1200x630 and reject or crop large files; the limit here is 300 KB.
const PNG = readFileSync(new URL('../../public/og-image.png', import.meta.url));
const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('og-image.png', () => {
    test('is a 1200x630 PNG under 300 KB', () => {
        expect(PNG.subarray(0, 8)).toEqual(SIGNATURE);
        // The first chunk is IHDR: length (4), type (4), then width and height, big-endian.
        expect(PNG.subarray(12, 16).toString('ascii')).toBe('IHDR');
        expect(PNG.readUInt32BE(16)).toBe(1200);
        expect(PNG.readUInt32BE(20)).toBe(630);
        expect(PNG.length).toBeLessThan(300 * 1024);
    });
});
