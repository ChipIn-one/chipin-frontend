import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, test, vi } from 'vitest';

import {
    emitRootFavicons,
    FAVICON_ICO_SOURCE,
    FAVICON_SVG_SOURCE,
    ROOT_FAVICONS,
    rootFaviconsMiddleware,
} from './rootFavicons';

describe('rootFavicons (issue 859)', () => {
    const dirs: string[] = [];

    afterEach(() => {
        for (const dir of dirs.splice(0)) {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test('the sources are the tokens SVG and the app ICO, and they exist', () => {
        expect(FAVICON_SVG_SOURCE).toMatch(/packages[/\\]tokens[/\\]assets[/\\]favicon\.svg$/);
        expect(FAVICON_ICO_SOURCE).toMatch(/apps[/\\]app[/\\]public[/\\]favicon\.ico$/);
        expect(existsSync(FAVICON_SVG_SOURCE)).toBe(true);
        expect(existsSync(FAVICON_ICO_SOURCE)).toBe(true);
    });

    test('emitRootFavicons writes byte copies of both sources', () => {
        const dir = mkdtempSync(join(tmpdir(), 'root-favicons-'));

        dirs.push(dir);
        emitRootFavicons(dir);
        expect(
            readFileSync(join(dir, 'favicon.svg')).equals(readFileSync(FAVICON_SVG_SOURCE)),
        ).toBe(true);
        expect(
            readFileSync(join(dir, 'favicon.ico')).equals(readFileSync(FAVICON_ICO_SOURCE)),
        ).toBe(true);
    });

    const serve = (url: string) => {
        const headers: Record<string, string> = {};
        let body: Buffer | undefined;
        const response = {
            setHeader: (name: string, value: string) => {
                headers[name] = value;
            },
            end: (chunk: Buffer) => {
                body = chunk;
            },
        } as unknown as ServerResponse;
        const next = vi.fn();

        rootFaviconsMiddleware({ url } as IncomingMessage, response, next);
        return { headers, body, next };
    };

    test.each([
        ['/favicon.svg', 'image/svg+xml'],
        ['/favicon.svg?v=1', 'image/svg+xml'],
        ['/favicon.ico', 'image/x-icon'],
    ])('the dev middleware serves %s as %s', (url, contentType) => {
        const { headers, body, next } = serve(url);
        const favicon = ROOT_FAVICONS.find(({ contentType: type }) => type === contentType);

        expect(next).not.toHaveBeenCalled();
        expect(headers['Content-Type']).toBe(contentType);
        expect(favicon && body?.equals(readFileSync(favicon.source))).toBe(true);
    });

    test.each(['/', '/favicon.png', '/_astro/favicon.Ab12Cd34.svg', '/ru/favicon.svg'])(
        'the dev middleware passes %s on',
        url => {
            const { headers, body, next } = serve(url);

            expect(next).toHaveBeenCalledOnce();
            expect(headers).toEqual({});
            expect(body).toBeUndefined();
        },
    );
});
