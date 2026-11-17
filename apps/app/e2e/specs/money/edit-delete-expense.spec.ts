// Money-critical flows (#667): editing and deleting an expense recalculates the balances of both
// participants. The expense is arranged through the staging API; the edit or delete goes through
// the expense history page (Expenses tab -> the expense), as a user reaches it.
import type { Page } from '@playwright/test';

import { expect, test } from '../../support/fixtures';
import type { ProvisionedUser, ProvisioningClient } from '../../support/provisioning';
import {
    expectBalance,
    expectSettledUp,
    openGroupTab,
    openGroupWithGroupsList,
    selectGroupTab,
    uniqueSuffix,
    visibleOne,
} from '../../support/ui';

interface ExpenseSetup {
    payer: ProvisionedUser;
    participant: ProvisionedUser;
    groupId: string;
    description: string;
}

/** The payer paid 30 USD split equally with the participant: the participant owes 15 USD. */
const arrangeExpense = async (provisioning: ProvisioningClient): Promise<ExpenseSetup> => {
    const payer = await provisioning.register('E2E Payer');
    const participant = await provisioning.register('E2E Participant');
    await provisioning.makeFriends(payer, participant);
    const groupId = await provisioning.createGroup(payer, `E2E Group ${uniqueSuffix()}`, [
        participant,
    ]);
    const description = `E2E taxi ${uniqueSuffix()}`;
    await provisioning.addEqualGroupExpense({
        groupId,
        payer,
        participants: [payer, participant],
        amount: 30,
        description,
    });

    return { payer, participant, groupId, description };
};

/**
 * From the open group page, opens the expense's history and returns its action button. On a
 * narrow screen the details (with the actions) sit in a collapsed disclosure: it is opened first.
 */
const openExpenseAction = async (
    page: Page,
    description: string,
    action: 'Update' | 'Delete',
): Promise<void> => {
    const expenses = await selectGroupTab(page, 'Expenses');
    await expenses.getByRole('link').filter({ hasText: description }).click();

    const button = page.getByRole('button', { name: action, exact: true });
    const collapsedDetails = page.locator('summary').filter({ hasText: description });
    // The wide layout shows the button, the narrow one the summary; the other copy is not displayed.
    await expect(visibleOne(button.or(collapsedDetails))).toBeVisible();
    if ((await button.filter({ visible: true }).count()) === 0) {
        await visibleOne(collapsedDetails).click();
    }
    await visibleOne(button).click();
};

test.describe('EXP-044 EXP-050 changing an expense', () => {
    test('EXP-044 editing the amount recalculates both balances', async ({
        provisioning,
        signIn,
    }) => {
        const { payer, participant, groupId, description } = await arrangeExpense(provisioning);

        const payerPage = await signIn(payer);
        // The editor takes the group's members from the groups list (#718).
        await openGroupWithGroupsList(payerPage, groupId);
        await openExpenseAction(payerPage, description, 'Update');
        const dialog = payerPage.getByRole('dialog', { name: 'Edit expense' });
        const amount = dialog.getByPlaceholder('0.00');
        await expect(amount).toHaveValue(/^30(\.0+)?$/);
        await amount.fill('50');
        const save = dialog.getByRole('button', { name: 'Save', exact: true });
        await expect(save).toBeEnabled();
        await save.click();
        await expect(dialog).toBeHidden();

        const payerBalances = await openGroupTab(payerPage, groupId, 'Balances');
        await expectBalance(payerBalances, participant.displayName, 'You are owed', '25');

        const participantPage = await signIn(participant);
        const participantBalances = await openGroupTab(participantPage, groupId, 'Balances');
        await expectBalance(participantBalances, payer.displayName, 'You owe', '25');
    });

    test('BAL-004 EXP-050 deleting the expense settles both participants', async ({
        provisioning,
        signIn,
    }) => {
        const { payer, participant, groupId, description } = await arrangeExpense(provisioning);

        // Any active member may delete a group expense (EXP-051): the participant does.
        const participantPage = await signIn(participant);
        const before = await openGroupTab(participantPage, groupId, 'Balances');
        await expectBalance(before, payer.displayName, 'You owe', '15');
        await openExpenseAction(participantPage, description, 'Delete');
        const confirm = participantPage.getByRole('alertdialog', { name: 'Delete entry?' });
        await confirm.getByRole('button', { name: 'Delete entry' }).click();
        await expect(confirm).toBeHidden();
        // A deleted expense keeps its history but loses its actions.
        await expect(
            participantPage.getByRole('button', { name: 'Delete', exact: true }),
        ).toHaveCount(0);

        const participantBalances = await openGroupTab(participantPage, groupId, 'Balances');
        await expectSettledUp(participantBalances, payer.displayName);

        const payerPage = await signIn(payer);
        const payerBalances = await openGroupTab(payerPage, groupId, 'Balances');
        await expectSettledUp(payerBalances, participant.displayName);
    });
});
