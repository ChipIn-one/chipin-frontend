import { expect, test } from 'vitest';

import enFriends from './locales/en/friends.json';
import enGroup from './locales/en/group.json';
import ruFriends from './locales/ru/friends.json';
import ruGroup from './locales/ru/group.json';

const JOIN_KEYS = ['cancel', 'confirm', 'description', 'goHome', 'invalidTitle', 'retry', 'title'];

const LOCALES = {
    en: { friends: enFriends, group: enGroup },
    ru: { friends: ruFriends, group: ruGroup },
};

test.each(Object.entries(LOCALES))(
    '%s has every join.* key in group and friends',
    (_locale, namespaces) => {
        for (const { join } of [namespaces.group, namespaces.friends]) {
            expect(Object.keys(join).sort()).toEqual(JOIN_KEYS);

            for (const value of Object.values(join)) {
                expect(value.trim()).not.toBe('');
            }
        }
    },
);
