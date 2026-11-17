// Money-critical flows (#667): one money screen (group Balances) in both interface languages. The
// amount display is locale-independent (basics/numbers/amount/Amount.tsx via helpers/numbers.ts:
// "." decimal separator, "," thousands, the currency code after the number), so the same amount
// text is expected in English and in Russian, with the translated label before it.
import { expect, test } from '../../support/fixtures';
import {
    clickAndSaveSettings,
    exactBalance,
    openGroupTab,
    selectGroupTab,
    uniqueSuffix,
    visibleOne,
} from '../../support/ui';

test.describe('interface languages', () => {
    test('a balance with cents reads the same amount in English and in Russian', async ({
        provisioning,
        signIn,
    }) => {
        const payer = await provisioning.register('E2E Payer');
        const friend = await provisioning.register('E2E Friend');
        await provisioning.makeFriends(payer, friend);
        const groupId = await provisioning.createGroup(payer, `E2E Group ${uniqueSuffix()}`, [
            friend,
        ]);
        // 24.68 split equally: the friend owes 12.34.
        await provisioning.addEqualGroupExpense({
            groupId,
            payer,
            participants: [payer, friend],
            amount: 24.68,
            description: `E2E museum ${uniqueSuffix()}`,
        });

        const page = await signIn(payer);
        const english = await openGroupTab(page, groupId, 'Balances');
        await expect(english.getByText(friend.displayName)).toBeVisible();
        await expect(english.getByText(/^You are owed\b/)).toHaveText(
            exactBalance('You are owed', '12.34'),
        );

        // In-app navigation there and back keeps one document: no reload races the settings write
        // (#719).
        await visibleOne(page.getByRole('link', { name: 'Settings', exact: true })).click();
        await page.getByRole('button', { name: 'English', exact: true }).click();
        await clickAndSaveSettings(page, () =>
            page.getByRole('button', { name: 'Russian', exact: true }).click(),
        );
        await expect(page.getByText('Язык интерфейса')).toBeVisible();
        await page.goBack();

        const russian = await selectGroupTab(page, 'Балансы');
        await expect(russian.getByText(friend.displayName)).toBeVisible();
        await expect(russian.getByText(/^Вам должны/)).toHaveText(
            exactBalance('Вам должны', '12.34'),
        );
    });
});
