// Money-critical flows (#667): going offline, on every profile. With the production flags no change
// can wait offline and sync later: offline writes are behind VITE_FEATURE_OFFLINE_WRITES (off), and
// the ledger, group and user writes are refused while offline (hooks/useLedgerMutations.ts,
// useGroupMutations.ts, useUserMutations.ts). So only the banner and the saved data it promises are
// checked: the in-memory query cache of the open page. `context.setOffline` works in all engines.
// Service workers are allowed only in Chromium (a Vercel Preview target registers one; the Vite dev
// server does not): Playwright supports network control of service workers only in Chromium, so in
// Firefox and WebKit they stay blocked and the worker's offline cache is not covered there (#735).
import { expect, test } from '../../support/fixtures';
import {
    exactBalance,
    expectBalance,
    openGroupTab,
    selectGroupTab,
    uniqueSuffix,
} from '../../support/ui';

// https://github.com/ChipIn-one/chipin-frontend/issues/735: service workers in Firefox and WebKit.
test.use({
    serviceWorkers: async ({ browserName }, provide) => {
        await provide(browserName === 'chromium' ? 'allow' : 'block');
    },
});

test.describe('offline', () => {
    test('going offline shows the banner over the saved balance, and reconnecting hides it', async ({
        provisioning,
        signIn,
    }) => {
        const payer = await provisioning.register('E2E Payer');
        const friend = await provisioning.register('E2E Friend');
        await provisioning.makeFriends(payer, friend);
        const groupId = await provisioning.createGroup(payer, `E2E Group ${uniqueSuffix()}`, [
            friend,
        ]);
        await provisioning.addEqualGroupExpense({
            groupId,
            payer,
            participants: [payer, friend],
            amount: 30,
            description: `E2E lunch ${uniqueSuffix()}`,
        });

        const page = await signIn(payer);
        const balances = await openGroupTab(page, groupId, 'Balances');
        await expectBalance(balances, friend.displayName, 'You are owed', '15');

        const banner = page
            .getByRole('status')
            .filter({ hasText: 'No network. Saved data is shown' });
        await expect(banner).toHaveCount(0);

        await page.context().setOffline(true);
        await expect(banner).toBeVisible();
        await expect(banner.getByRole('button', { name: 'Retry' })).toBeVisible();
        await expectBalance(balances, friend.displayName, 'You are owed', '15');

        await page.context().setOffline(false);
        await expect(banner).toHaveCount(0);
        // On the Vite dev server the HMR client may reload the page once it reconnects, which
        // resets the tab to Expenses: the tab is selected again, retried while a reload happens.
        await expect(async () => {
            const after = await selectGroupTab(page, 'Balances');
            await expect(after.getByText(/^You are owed\b/)).toHaveText(
                exactBalance('You are owed', '15'),
                { timeout: 2_000 },
            );
        }).toPass({ timeout: 15_000 });
    });
});
