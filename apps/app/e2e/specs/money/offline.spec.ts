// Money-critical flows (#667): going offline. Chromium only, with service workers allowed for this
// file (the Vite dev server registers none, `devOptions.enabled: false`; a Vercel Preview target
// does). With the production flags no change can wait offline and sync later: offline writes are
// behind VITE_FEATURE_OFFLINE_WRITES (off), and the ledger, group and user writes are refused while
// offline (hooks/useLedgerMutations.ts, useGroupMutations.ts, useUserMutations.ts). So only the
// banner and the saved data it promises are checked.
import { expect, test } from '../../support/fixtures';
import { expectBalance, openGroupTab, uniqueSuffix } from '../../support/ui';

test.use({ serviceWorkers: 'allow' });

test.describe('offline', () => {
    test.skip(
        ({ browserName }) => browserName !== 'chromium',
        'The offline spec runs in Chromium only',
    );

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
        await expectBalance(balances, friend.displayName, 'You are owed', '15');
    });
});
