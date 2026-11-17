// Money-critical flows (#667): an unequal split. Preconditions are arranged through the staging API;
// the checked action goes through the UI, and both participants' balances are asserted as shown. The
// payer's page is never reloaded after the write (#724): it switches tabs in place.
import { expect, test } from '../../support/fixtures';
import {
    expectBalance,
    expectExpenseDialogMembers,
    openGroupTab,
    openGroupWithGroupsList,
    selectGroupTab,
    uniqueSuffix,
    visibleOne,
} from '../../support/ui';

test.describe('EXP-011 unequal split', () => {
    test('an expense split by amounts gives each participant their own share', async ({
        provisioning,
        signIn,
    }) => {
        const payer = await provisioning.register('E2E Payer');
        const friend = await provisioning.register('E2E Friend');
        await provisioning.makeFriends(payer, friend);
        const groupId = await provisioning.createGroup(payer, `E2E Group ${uniqueSuffix()}`, [
            friend,
        ]);
        const description = `E2E hotel ${uniqueSuffix()}`;

        const payerPage = await signIn(payer);
        await openGroupWithGroupsList(payerPage, groupId);
        await visibleOne(
            payerPage.getByRole('button', { name: 'Add expense', exact: true }),
        ).click();
        const dialog = payerPage.getByRole('dialog', { name: 'Add an expense' });
        await expectExpenseDialogMembers(dialog, friend.displayName);
        await dialog.getByRole('textbox', { name: 'Amount', exact: true }).fill('30');
        await dialog.getByRole('textbox', { name: 'Description', exact: true }).fill(description);
        await dialog.getByRole('radio', { name: 'Amounts' }).click();

        // Each split input is named after its participant (#725).
        const shareInput = (name: string) =>
            dialog.getByRole('textbox', { name: `${name} amount`, exact: true });
        await shareInput(payer.displayName).fill('10');
        await shareInput(friend.displayName).fill('20');

        const submit = dialog.getByRole('button', { name: 'Add expense', exact: true });
        await expect(submit).toBeEnabled();
        await submit.click();
        await expect(dialog).toBeHidden();

        const expenses = await selectGroupTab(payerPage, 'Expenses');
        await expect(expenses.getByText(description)).toBeVisible();
        const payerBalances = await selectGroupTab(payerPage, 'Balances');
        await expectBalance(payerBalances, friend.displayName, 'You are owed', '20');

        const friendPage = await signIn(friend);
        const friendBalances = await openGroupTab(friendPage, groupId, 'Balances');
        await expectBalance(friendBalances, payer.displayName, 'You owe', '20');
    });
});
