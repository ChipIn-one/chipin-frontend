// SMOKE-SHORT b-e (docs/engineering/release-qa.md, scripts/release-qa/impact-rules.mjs) in Chromium.
// Item a (Google sign-in opens Dashboard) needs the real OAuth flow and stays manual. Preconditions
// are arranged through the staging API; the checked action goes through the UI.
import type { Page, Response } from '@playwright/test';

import { expect, test } from '../support/fixtures';

// Every name is unique per test, so a leftover of another run can never match.
const uniqueSuffix = (): string => crypto.randomUUID().slice(0, 8);

const openGroupTab = async (page: Page, groupId: string, tab: 'Balances' | 'Expenses') => {
    await page.goto(`/group/${groupId}`);
    await page.getByRole('tab', { name: tab }).click();

    return page.getByRole('tabpanel', { name: tab });
};

/** The whole balance line, e.g. "You are owed 5 USD" (BalanceSummaryText), and nothing more. */
const exactBalance = (label: 'You are owed' | 'You owe', amount: string): RegExp =>
    new RegExp(`^${label}\\s+${amount}\\s+USD$`);

/** The settings write (entities/users/api/mutations.ts: `PATCH /users/self`). */
const isSelfSettingsWrite = (response: Response): boolean =>
    response.request().method() === 'PATCH' &&
    /\/api\/users\/self$/.test(new URL(response.url()).pathname);

/** Clicks and waits until the settings write it causes has succeeded on the server. */
const clickAndSaveSettings = async (page: Page, click: () => Promise<void>): Promise<void> => {
    const [response] = await Promise.all([page.waitForResponse(isSelfSettingsWrite), click()]);

    expect(response.status(), 'PATCH /users/self status').toBeLessThan(300);
};

/**
 * The user's persisted query cache (shared/offline/queryPersister.ts: idb-keyval, key
 * `chipin:rq:<userId>`) as text, or null. Its writes are throttled by 1 s, so a reload sooner
 * restores the previous settings for a moment; a person reloading is never that fast.
 */
const readPersistedCache = (page: Page, userId: string): Promise<string | null> =>
    page.evaluate(
        async key =>
            new Promise<string | null>(resolve => {
                const open = indexedDB.open('keyval-store');
                open.onerror = () => resolve(null);
                open.onsuccess = () => {
                    const db = open.result;
                    if (!db.objectStoreNames.contains('keyval')) {
                        db.close();
                        resolve(null);
                        return;
                    }
                    const read = db.transaction('keyval').objectStore('keyval').get(key);
                    read.onerror = () => resolve(null);
                    read.onsuccess = () => {
                        const value: unknown = read.result;
                        db.close();
                        resolve(typeof value === 'string' ? value : null);
                    };
                };
            }),
        `chipin:rq:${userId}`,
    );

test.describe('SMOKE-SHORT', () => {
    test('an equal-split group expense is listed and changes the balance', async ({
        provisioning,
        signIn,
    }) => {
        const payer = await provisioning.register('E2E Payer');
        const friend = await provisioning.register('E2E Friend');
        await provisioning.makeFriends(payer, friend);
        const groupId = await provisioning.createGroup(payer, `E2E Group ${uniqueSuffix()}`, [
            friend,
        ]);
        const description = `E2E dinner ${uniqueSuffix()}`;
        const page = await signIn(payer);

        const balancesBefore = await openGroupTab(page, groupId, 'Balances');
        await expect(balancesBefore.getByText(friend.displayName)).toBeVisible();
        // "Settled up" is both the friend's row status and the disabled settle button's name.
        await expect(balancesBefore.getByRole('button', { name: 'Settled up' })).toBeDisabled();

        // The desktop sidebar's button: at this viewport the floating and mobile-bar variants are
        // `display: none`, so they are not in the accessibility tree (strict mode would catch a
        // second visible one). No landmark wraps the sidebar to scope it further.
        await page.getByRole('button', { name: 'Add expense', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Add an expense' });
        // Neither field has an accessible label (the "Amount" text is not bound to the input), so
        // the placeholders are their only stable handles.
        await dialog.getByPlaceholder('0.00').fill('10');
        await dialog.getByPlaceholder('e.g. Hotel booking, dinner...').fill(description);
        await dialog.getByRole('button', { name: 'Add expense', exact: true }).click();
        await expect(dialog).toBeHidden();

        await page.getByRole('tab', { name: 'Expenses' }).click();
        await expect(
            page.getByRole('tabpanel', { name: 'Expenses' }).getByText(description),
        ).toBeVisible();

        await page.getByRole('tab', { name: 'Balances' }).click();
        const balancesAfter = page.getByRole('tabpanel', { name: 'Balances' });
        await expect(balancesAfter.getByText('Settled up')).toHaveCount(0);
        await expect(balancesAfter.getByText(/^You are owed/)).toHaveText(
            exactBalance('You are owed', '6'),
        );
    });

    test('the other participant sees the matching balance in Balances', async ({
        provisioning,
        signIn,
    }) => {
        const payer = await provisioning.register('E2E Payer');
        const participant = await provisioning.register('E2E Participant');
        await provisioning.makeFriends(payer, participant);
        const groupId = await provisioning.createGroup(payer, `E2E Group ${uniqueSuffix()}`, [
            participant,
        ]);
        await provisioning.addEqualGroupExpense({
            groupId,
            payer,
            participants: [payer, participant],
            amount: 30,
            description: `E2E taxi ${uniqueSuffix()}`,
        });

        const payerPage = await signIn(payer);
        const payerBalances = await openGroupTab(payerPage, groupId, 'Balances');
        await expect(payerBalances.getByText(participant.displayName)).toBeVisible();
        await expect(payerBalances.getByText(/^You are owed/)).toHaveText(
            exactBalance('You are owed', '15'),
        );

        const participantPage = await signIn(participant);
        const participantBalances = await openGroupTab(participantPage, groupId, 'Balances');
        await expect(participantBalances.getByText(payer.displayName)).toBeVisible();
        await expect(participantBalances.getByText(/^You owe/)).toHaveText(
            exactBalance('You owe', '14'),
        );
    });

    test('language and theme apply without a flash and survive a reload', async ({
        provisioning,
        signIn,
    }) => {
        const user = await provisioning.register('E2E Settings');
        const page = await signIn(user);

        await page.goto('/settings');
        // Each choice is saved on the server before the reload, which would otherwise race it.
        await clickAndSaveSettings(page, () => page.getByRole('radio', { name: 'Dark' }).click());
        await expect(page.locator('html')).toHaveClass(/\bdark\b/);

        await page.getByRole('button', { name: 'English', exact: true }).click();
        await clickAndSaveSettings(page, () =>
            page.getByRole('button', { name: 'Russian', exact: true }).click(),
        );
        await expect(page.getByText('Язык интерфейса')).toBeVisible();
        await expect
            .poll(
                async () => {
                    const cache = await readPersistedCache(page, user.id);

                    return (
                        cache !== null &&
                        /"language":"ru/i.test(cache) &&
                        /"theme":"dark"/i.test(cache)
                    );
                },
                { message: 'the new settings reach the persisted query cache' },
            )
            .toBe(true);

        // From the next document on, record what the first frames show: a light theme root or an
        // English settings label at any point before the final state would be a flash.
        await page.context().addInitScript(() => {
            const seen = { lightTheme: false, englishText: false };
            Reflect.set(window, '__chipinE2eFirstFrames', seen);

            const inspect = (node: Node): void => {
                if (!(node instanceof Element)) {
                    return;
                }
                const themeRoots = [
                    ...(node.matches('.radix-themes') ? [node] : []),
                    ...Array.from(node.querySelectorAll('.radix-themes')),
                ];
                if (themeRoots.some(root => !root.classList.contains('dark'))) {
                    seen.lightTheme = true;
                }
                if (node.textContent?.includes('Interface language')) {
                    seen.englishText = true;
                }
            };

            new MutationObserver(records => {
                for (const record of records) {
                    if (record.type === 'attributes') {
                        inspect(record.target);
                    }
                    record.addedNodes.forEach(inspect);
                }
            }).observe(document, {
                attributes: true,
                attributeFilter: ['class'],
                childList: true,
                subtree: true,
            });
        });

        await page.reload();
        await expect(page.getByText('Язык интерфейса')).toBeVisible();
        await expect(page.getByRole('radio', { name: 'Светлая' })).toBeChecked();
        await expect(page.locator('html')).toHaveClass(/\bdark\b/);
        expect(
            await page.evaluate((): unknown => Reflect.get(window, '__chipinE2eFirstFrames')),
        ).toEqual({
            lightTheme: false,
            englishText: false,
        });
    });

    test('after log out, reloading a protected page asks to sign in again', async ({
        provisioning,
        signIn,
    }) => {
        const user = await provisioning.register('E2E Logout');
        const page = await signIn(user);

        await expect(page).not.toHaveURL(/\/settings/);

        await page.goto('/settings');
        await page.reload();
        const signInDialog = page.getByRole('dialog', { name: 'Welcome to ChipIn' });
        await expect(signInDialog).toBeVisible();
        await expect(
            signInDialog.getByRole('button', { name: 'Sign in with Google' }),
        ).toBeVisible();
    });
});
