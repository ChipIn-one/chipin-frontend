// Money-critical flows (#667): a second user joins a group through its invite link. The link the
// app shares points at the production app origin (helpers/url.ts `buildGroupInviteLink`), so the
// test opens its path, `/group/join/<token>`, on the app under test; the token is read through the
// staging API (GRP-015) and never logged.
import { expect, test } from '../../support/fixtures';
import { expectSettledUp, openGroupTab, selectGroupTab, uniqueSuffix } from '../../support/ui';

test.describe('GRP-030 join by invite link', () => {
    test('a second user joins through the invite link and both see each other', async ({
        provisioning,
        signIn,
    }) => {
        const owner = await provisioning.register('E2E Owner');
        const joiner = await provisioning.register('E2E Joiner');
        const groupName = `E2E Group ${uniqueSuffix()}`;
        const groupId = await provisioning.createGroup(owner, groupName, []);
        const inviteToken = await provisioning.getGroupInviteToken(owner, groupId);

        const joinerPage = await signIn(joiner);
        await joinerPage.goto(`/group/join/${inviteToken}`);
        await expect(
            joinerPage.getByRole('heading', { name: 'Join this group by invite?' }),
        ).toBeVisible();
        await joinerPage.getByRole('button', { name: 'Join', exact: true }).click();

        await expect(joinerPage).toHaveURL(new RegExp(`/group/${groupId}$`));
        await expect(joinerPage.getByText(groupName).first()).toBeVisible();
        const joinerBalances = await selectGroupTab(joinerPage, 'Balances');
        await expectSettledUp(joinerBalances, owner.displayName);

        const ownerPage = await signIn(owner);
        const ownerBalances = await openGroupTab(ownerPage, groupId, 'Balances');
        await expectSettledUp(ownerBalances, joiner.displayName);
    });
});
