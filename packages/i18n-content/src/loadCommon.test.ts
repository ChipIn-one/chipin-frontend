import { describe, expect, test } from 'vitest';

import en from '../common/en.json';
import ru from '../common/ru.json';

import { loadCommon } from './loadCommon';
import type { SupportedLocale } from './locales';

describe('loadCommon', () => {
    test('resolves each supported locale to its common JSON', async () => {
        await expect(loadCommon('en')).resolves.toEqual(en);
        await expect(loadCommon('ru')).resolves.toEqual(ru);
    });

    test('rejects an unknown locale instead of throwing', async () => {
        // A locale outside SupportedLocale, e.g. a stale value read from storage.
        const unknown = 'de' as SupportedLocale;
        let result: Promise<Record<string, unknown>> | undefined;

        expect(() => {
            result = loadCommon(unknown);
        }).not.toThrow();
        await expect(result).rejects.toThrow('de');
    });
});
