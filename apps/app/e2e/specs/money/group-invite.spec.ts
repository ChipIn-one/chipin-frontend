// Money-critical flows (#667): a second user joins a group through its invite link. The link is
// `<site>/join/group/<token>` (helpers/url.ts `buildGroupInviteLink`, spec 04 §3.5), which leads to
// the app route `/group/join/<token>` opened here. The app hands the link out only through the native share sheet or the clipboard, which a test
// cannot read in every browser, so the token is read through the staging API (GRP-015) and the
// link is opened on the app under test. The token appears in the `goto` URL, traces and failure
// output; it is dead after the run's purge.
import type { Response } from '@playwright/test';

import { expect, test } from '../../support/fixtures';
import { expectSettledUp, openGroupTab, selectGroupTab, uniqueSuffix } from '../../support/ui';

/** The join request (`POST /groups/invite/{inviteToken}`). */
const isGroupJoin = (response: Response): boolean =>
    response.request().method() === 'POST' &&
    new URL(response.url()).pathname.startsWith('/api/groups/invite/');

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
        // Join stays disabled (loading) until the session is restored (#730); the click waits for
        // the enabled button.
        await joinerPage.goto(`/group/join/${inviteToken}`);
        await expect(
            joinerPage.getByRole('heading', { name: 'Join this group by invite?' }),
        ).toBeVisible();
        const [joined] = await Promise.all([
            joinerPage.waitForResponse(isGroupJoin),
            joinerPage.getByRole('button', { name: 'Join', exact: true }).click(),
        ]);
        expect(joined.status(), 'POST /groups/invite/{inviteToken} status').toBeLessThan(300);

        await expect(joinerPage).toHaveURL(new RegExp(`/group/${groupId}$`));
        await expect(joinerPage.getByText(groupName).first()).toBeVisible();
        const joinerBalances = await selectGroupTab(joinerPage, 'Balances');
        await expectSettledUp(joinerBalances, owner.displayName);

        const ownerPage = await signIn(owner);
        const ownerBalances = await openGroupTab(ownerPage, groupId, 'Balances');
        await expectSettledUp(ownerBalances, joiner.displayName);
    });
});
