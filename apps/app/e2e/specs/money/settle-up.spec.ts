// Money-critical flows (#667): settle up in a group. The settle-up form has an amount but no note
// field (components/modals/settle-up-modal), so no test enters a note. The debt is arranged through
// the staging API, the payment is recorded in the UI, and both participants' balances and activity
// are asserted as shown.
import type { Page } from '@playwright/test';

import { expect, test } from '../../support/fixtures';
import type { ProvisionedUser, ProvisioningClient } from '../../support/provisioning';
import {
    escapeRegExp,
    exactBalance,
    expectBalance,
    expectSettledUp,
    openGroupTab,
    selectGroupTab,
    uniqueSuffix,
    visibleOne,
} from '../../support/ui';

interface DebtSetup {
    creditor: ProvisionedUser;
    debtor: ProvisionedUser;
    groupId: string;
}

/** The creditor paid 30 USD split equally with the debtor: the debtor owes 15 USD. */
const arrangeDebt = async (provisioning: ProvisioningClient): Promise<DebtSetup> => {
    const creditor = await provisioning.register('E2E Creditor');
    const debtor = await provisioning.register('E2E Debtor');
    await provisioning.makeFriends(creditor, debtor);
    const groupId = await provisioning.createGroup(creditor, `E2E Group ${uniqueSuffix()}`, [
        debtor,
    ]);
    await provisioning.addEqualGroupExpense({
        groupId,
        payer: creditor,
        participants: [creditor, debtor],
        amount: 30,
        description: `E2E dinner ${uniqueSuffix()}`,
    });

    return { creditor, debtor, groupId };
};

/**
 * Records a payment from the Balances panel: Settle up on the creditor's row, the debt, then the
 * amount (`null` keeps the prefilled full debt).
 */
const recordPayment = async (
    page: Page,
    groupId: string,
    creditor: ProvisionedUser,
    amount: string | null,
): Promise<void> => {
    const balances = await openGroupTab(page, groupId, 'Balances');
    await expectBalance(balances, creditor.displayName, 'You owe', '15');
    await balances.getByRole('button', { name: 'Settle up' }).click();

    const chooseDebt = page.getByRole('dialog', { name: 'Choose a debt' });
    await chooseDebt
        .getByRole('button', { name: new RegExp(escapeRegExp(creditor.displayName)) })
        .click();

    const payment = page.getByRole('dialog', { name: 'Record payment' });
    const amountInput = payment.getByLabel('Payment amount');
    // The form opens with the full debt.
    await expect(amountInput).toHaveValue('15');
    if (amount !== null) {
        await amountInput.fill(amount);
    }
    await payment.getByRole('button', { name: 'Record payment' }).click();
    await expect(payment).toBeHidden();
};

// The page that recorded the payment is never reloaded or reopened with `goto`: a reload within
// 1 s of a write restores the pre-write group from the persisted cache (throttled by 1 s) and does
// not refetch it while fresh (30 s), so the old balance would show (#724). The debtor
// stays in the app; the other participant opens a fresh context.
test.describe('SET-007 settle up', () => {
    test('a partial payment leaves the remaining debt and appears in both activities', async ({
        provisioning,
        signIn,
    }) => {
        const { creditor, debtor, groupId } = await arrangeDebt(provisioning);

        const debtorPage = await signIn(debtor);
        await recordPayment(debtorPage, groupId, creditor, '7.5');
        const debtorBalances = await selectGroupTab(debtorPage, 'Balances');
        await expectBalance(debtorBalances, creditor.displayName, 'You owe', '7.5');
        // In-app navigation: the write invalidated the activity feed in this document's cache, so
        // the Activity page reads it from the server.
        await visibleOne(debtorPage.getByRole('link', { name: 'Activity', exact: true })).click();
        await expect(debtorPage).toHaveURL(/\/activity$/);
        await expect(debtorPage.getByText(/^You paid\b/)).toHaveText(
            exactBalance('You paid', '7.5'),
        );

        const creditorPage = await signIn(creditor);
        const creditorBalances = await openGroupTab(creditorPage, groupId, 'Balances');
        await expectBalance(creditorBalances, debtor.displayName, 'You are owed', '7.5');
        await creditorPage.goto('/activity');
        const debtorPaid = `${debtor.displayName} paid`;
        await expect(
            creditorPage.getByText(new RegExp(`^${escapeRegExp(debtorPaid)}\\b`)),
        ).toHaveText(exactBalance(debtorPaid, '7.5'));
    });

    test('BAL-003 paying the full debt settles both participants', async ({
        provisioning,
        signIn,
    }) => {
        const { creditor, debtor, groupId } = await arrangeDebt(provisioning);

        const debtorPage = await signIn(debtor);
        await recordPayment(debtorPage, groupId, creditor, null);
        const debtorBalances = await selectGroupTab(debtorPage, 'Balances');
        await expectSettledUp(debtorBalances, creditor.displayName);

        const creditorPage = await signIn(creditor);
        const creditorBalances = await openGroupTab(creditorPage, groupId, 'Balances');
        await expectSettledUp(creditorBalances, debtor.displayName);
    });
});
