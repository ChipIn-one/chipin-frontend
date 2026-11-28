// The capture recipes (#998): the prose `setup.steps` of each manifest row
// (docs/design-system/screens.manifest.json) as helper and locator code. `open` runs once per
// variant, after the width and colour scheme are set (layouts swap controls between phone and
// desktop, and the site applies the theme only at load); `prepare` runs once per row, for steps
// that write (a settlement). A row without a recipe
// is "missing" and fails the run by name (captureModel.ts `computeRecipeCoverage`).
import { expect, type Locator, type Page } from '@playwright/test';

import type { ScreenEntry } from '../../src/test/screenManifest';
import {
    escapeRegExp,
    expectExpenseDialogMembers,
    gotoAfterGroupsList,
    openGroupTab,
    openGroupWithGroupsList,
    visibleOne,
} from '../support/ui';

import type { ScenarioData } from './scenarios';

export interface CaptureContext {
    page: Page;
    row: ScreenEntry;
    scenario: ScenarioData;
    /** Path params found by `prepare` or `open` (`parentActivityId`), next to the scenario's. */
    params: Record<string, string>;
    /** The row's path with its params filled in. */
    path: () => string;
    /** Resolves once a `hang` mock of the row has held a request since this `open` started. */
    waitForHeldRequest: () => Promise<void>;
}

export interface Recipe {
    /** Once per row, before the mocks are installed: steps that write. */
    prepare?: (context: CaptureContext) => Promise<void>;
    /** Once per variant: opens the row's state and waits until it is shown. */
    open: (context: CaptureContext) => Promise<void>;
}

// Error states retry before they show (TanStack Query backoff), so they get a longer wait.
const ERROR_STATE_TIMEOUT = 45_000;

const dialog = (page: Page, name?: string | RegExp): Locator =>
    visibleOne(page.getByRole('dialog', { name }).or(page.getByRole('alertdialog', { name })));

const retryButton = (page: Page): Locator =>
    visibleOne(page.getByRole('button', { name: /^(Retry|Try again)$/ }));

const expectVisibleText = async (page: Page, text: string | RegExp): Promise<void> => {
    await expect(visibleOne(page.getByText(text))).toBeVisible();
};

const clickButton = async (scope: Page | Locator, name: string | RegExp): Promise<void> => {
    await visibleOne(scope.getByRole('button', { name, exact: typeof name === 'string' })).click();
};

/** The row's path on a signed-in page, once the session is restored (the groups list is read). */
const visitSignedIn = (context: CaptureContext): Promise<void> =>
    gotoAfterGroupsList(context.page, context.path());

/** The row's path without waiting for any read (a mocked read, an anonymous page). */
const visit = async (context: CaptureContext): Promise<void> => {
    await context.page.goto(context.path());
};

const groupId = (context: CaptureContext): string => {
    if (!context.scenario.groupId) {
        throw new Error(`${context.row.id}: the scenario has no group`);
    }

    return context.scenario.groupId;
};

const recipe = (open: Recipe['open'], prepare?: Recipe['prepare']): Recipe =>
    prepare ? { open, prepare } : { open };

/** Opens the row's path and waits for a visible text. */
const showsText = (text: string | RegExp, signedIn = true): Recipe =>
    recipe(async context => {
        await (signedIn ? visitSignedIn(context) : visit(context));
        await expectVisibleText(context.page, text);
    });

/** Opens the row's path; a `hang` mock then holds the read the loading state waits for. */
const holdsRead = (): Recipe =>
    recipe(async context => {
        await visit(context);
        await context.waitForHeldRequest();
    });

/** Opens the row's path; a failing mock then shows the load error with its Retry. */
const showsLoadError = (): Recipe =>
    recipe(async context => {
        await visit(context);
        await expect(retryButton(context.page)).toBeVisible({ timeout: ERROR_STATE_TIMEOUT });
    });

/** Scrolls a feed down until the soft Retry of its failed next page shows. */
const scrollToNextPageError = async (page: Page): Promise<void> => {
    await expect(async () => {
        await page.mouse.wheel(0, 10_000);
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await expect(retryButton(page)).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: ERROR_STATE_TIMEOUT });
};

/** `/activity`, then the feed row of an entry: its details page. Records `parentActivityId`. */
const openActivityDetails = async (context: CaptureContext, row: Locator): Promise<void> => {
    const { page } = context;
    await gotoAfterGroupsList(page, '/activity');
    await visibleOne(row).click();
    await expect(page).toHaveURL(/\/activity\/[^/?#]+$/);
    const parentActivityId = new URL(page.url()).pathname.split('/').pop();
    if (parentActivityId) {
        context.params.parentActivityId = parentActivityId;
    }
};

const dinnerRow = (page: Page): Locator => page.getByRole('link').filter({ hasText: 'E2E dinner' });

/**
 * The Update or Delete action of the open activity details. On a narrow screen the actions sit in
 * a collapsed disclosure, which is opened first (as in specs/money/edit-delete-expense.spec.ts).
 */
const clickDetailsAction = async (page: Page, action: 'Update' | 'Delete'): Promise<void> => {
    const button = page.getByRole('button', { name: action, exact: true });
    const collapsed = page.locator('summary');
    await expect(visibleOne(button.or(collapsed))).toBeVisible();
    if ((await button.filter({ visible: true }).count()) === 0) {
        await visibleOne(collapsed).click();
    }
    await visibleOne(button).click();
};

/** The group's Settings tab, then a button in it, then its dialog. */
const settingsDialog = (button: string | RegExp): Recipe =>
    recipe(async context => {
        const panel = await openGroupTab(context.page, groupId(context), 'Settings');
        await clickButton(panel, button);
        await expect(dialog(context.page)).toBeVisible();
    });

/** The friends page, a friend's "More actions" menu, then one of its items and its dialog. */
const friendMenuDialog = (friend: string, item: string): Recipe =>
    recipe(async context => {
        const { page } = context;
        await gotoAfterGroupsList(page, '/friends');
        await clickButton(page, `More actions for ${friend}`);
        await visibleOne(page.getByRole('menuitem', { name: item })).click();
        await expect(dialog(page)).toBeVisible();
    });

/** The Add expense editor on the group page, its group's members listed. */
const openGroupExpenseEditor = async (
    context: CaptureContext,
    member: string,
): Promise<Locator> => {
    const { page } = context;
    await openGroupWithGroupsList(page, groupId(context));
    await clickButton(page, 'Add expense');
    const editor = dialog(page, 'Add an expense');
    await expectExpenseDialogMembers(editor, member);

    return editor;
};

const LONG_MEMBER = 'E2E Member 1 with a rather long display name';

const SITE_ROW: Recipe = recipe(async context => {
    await visit(context);
    await context.page.waitForLoadState('load');
});

/** Screen id → recipe. Keep the keys in manifest order. */
export const RECIPES: Readonly<Record<string, Recipe>> = {
    login: showsText('Sign in with Google', false),
    'login.return-to': recipe(async ({ page }) => {
        await page.goto('/settings');
        await expect(page).toHaveURL(/\/login\?returnTo=/);
        await expectVisibleText(page, 'Sign in with Google');
    }),
    'login.in-app-browser': showsText(/does not work in this app's built-in browser/, false),
    'oauth-callback.signing-in': recipe(async context => {
        await visit(context);
        await context.waitForHeldRequest();
        await expectVisibleText(context.page, 'Signing you in…');
    }),

    dashboard: showsText('E2E Trip'),
    'dashboard.welcome': showsText('Create your first group or add friends'),
    'dashboard.empty': recipe(visitSignedIn),
    'dashboard.loading': holdsRead(),
    'dashboard.error': showsLoadError(),
    'dashboard.refresh-error': recipe(async context => {
        await visitSignedIn(context);
        await expect(retryButton(context.page)).toBeVisible({ timeout: ERROR_STATE_TIMEOUT });
    }),
    'dashboard.offline': showsText(/^You are owed\b/),
    'dashboard.long-content': showsText(/^E2E Weekend in the mountains/),
    'dashboard.groups-no-match': recipe(async context => {
        const { page } = context;
        await visitSignedIn(context);
        const search = page.getByRole('searchbox', { name: 'Search groups' });
        const textbox = page.getByRole('textbox', { name: 'Search groups' });
        const field = search.or(textbox);
        // On some layouts the field opens from a "Search groups" button first.
        if ((await field.filter({ visible: true }).count()) === 0) {
            await clickButton(page, 'Search groups');
        }
        await visibleOne(field).fill('zzz no match');
        await expectVisibleText(page, 'No groups found');
    }),

    group: recipe(async context => {
        await openGroupWithGroupsList(context.page, groupId(context));
        await expectVisibleText(context.page, 'E2E dinner');
    }),
    'group.balances': recipe(async context => {
        const panel = await openGroupTab(context.page, groupId(context), 'Balances');
        await expect(panel.getByRole('button', { name: 'Settle up' })).toBeVisible();
    }),
    'group.balances.settled': recipe(async context => {
        const panel = await openGroupTab(context.page, groupId(context), 'Balances');
        await expect(panel.getByText('Settled', { exact: true })).toBeVisible();
    }),
    'group.settings': recipe(async context => {
        const panel = await openGroupTab(context.page, groupId(context), 'Settings');
        await expect(visibleOne(panel.getByRole('button', { name: /Show QR code/ }))).toBeVisible();
    }),
    'group.solo': recipe(context => openGroupWithGroupsList(context.page, groupId(context))),
    'group.empty': recipe(async context => {
        await openGroupWithGroupsList(context.page, groupId(context));
        await expect(
            visibleOne(context.page.getByRole('button', { name: 'Add expense', exact: true })),
        ).toBeVisible();
    }),
    'group.loading': holdsRead(),
    'group.error': showsLoadError(),
    'group.not-found': showsText('It may have been deleted, or you are no longer a member.'),
    'group.invalid-id': recipe(visitSignedIn),
    'group.offline': recipe(async context => {
        await openGroupWithGroupsList(context.page, groupId(context));
        await expectVisibleText(context.page, 'E2E dinner');
    }),
    'group.next-page-error': recipe(async context => {
        await openGroupWithGroupsList(context.page, groupId(context));
        await expectVisibleText(context.page, /^E2E expense \d+$/);
        await scrollToNextPageError(context.page);
    }),
    'group.long-content': recipe(async context => {
        await openGroupWithGroupsList(context.page, groupId(context));
        await expectVisibleText(context.page, /^E2E very long expense description/);
    }),

    'group-join': recipe(async context => {
        await visit(context);
        await expect(
            context.page.getByRole('heading', { name: 'Join this group by invite?' }),
        ).toBeVisible();
        // Enabled once the session is restored (#730).
        await expect(context.page.getByRole('button', { name: 'Join', exact: true })).toBeEnabled();
    }),
    'group-join.joining': recipe(async context => {
        await visit(context);
        await context.page.getByRole('button', { name: 'Join', exact: true }).click();
        await context.waitForHeldRequest();
    }),
    'group-join.invalid': recipe(async context => {
        await visit(context);
        await context.page.getByRole('button', { name: 'Join', exact: true }).click();
        await expectVisibleText(context.page, 'This invite link is not valid');
    }),
    'group-join.error': recipe(async context => {
        await visit(context);
        await context.page.getByRole('button', { name: 'Join', exact: true }).click();
        await expect(retryButton(context.page)).toBeVisible({ timeout: ERROR_STATE_TIMEOUT });
    }),
    'friend-join.invalid': recipe(async context => {
        await visit(context);
        await context.page.getByRole('button', { name: 'Accept', exact: true }).click();
        await expectVisibleText(context.page, 'This invite link is not valid');
    }),

    activity: showsText('E2E dinner'),
    'activity.empty': showsText('Recent expenses and settlements will appear here.'),
    'activity.filtered-empty': recipe(async context => {
        const { page } = context;
        await visitSignedIn(context);
        await expectVisibleText(page, 'E2E dinner');
        const filter = page
            .getByRole('radio', { name: 'Settlements' })
            .or(page.getByRole('tab', { name: 'Settlements' }))
            .or(page.getByRole('button', { name: 'Settlements', exact: true }));
        await visibleOne(filter).click();
        await expectVisibleText(page, 'Nothing matches this filter');
    }),
    'activity.loading': holdsRead(),
    'activity.error': showsLoadError(),
    'activity.offline': showsText('E2E dinner'),
    'activity.offline-no-data': recipe(async ({ page }) => {
        await gotoAfterGroupsList(page, '/dashboard');
        await expectVisibleText(page, 'E2E dinner');
        await page.context().setOffline(true);
        await visibleOne(page.getByRole('link', { name: 'Activity', exact: true })).click();
        await expect(page).toHaveURL(/\/activity$/);
        await expectVisibleText(page, /^No network/);
    }),
    'activity.next-page-error': recipe(async context => {
        await visitSignedIn(context);
        await expectVisibleText(context.page, /^E2E expense \d+$/);
        await scrollToNextPageError(context.page);
    }),
    'activity.long-content': showsText(/^E2E very long expense description/),

    'activity-details': recipe(async context => {
        await openActivityDetails(context, dinnerRow(context.page));
        await expect(
            visibleOne(
                context.page
                    .getByRole('button', { name: 'Update', exact: true })
                    .or(context.page.locator('summary')),
            ),
        ).toBeVisible();
    }),
    'activity-details.settlement': recipe(
        async context => {
            const { page } = context;
            await openActivityDetails(
                context,
                page.getByRole('link').filter({ has: page.getByText(/^You paid\b/) }),
            );
            await expectVisibleText(page, /\bpaid\b/);
        },
        // As B (the debtor): a partial payment of the 15 USD debt to A, as in settle-up.spec.ts.
        async context => {
            const { page } = context;
            const panel = await openGroupTab(page, groupId(context), 'Balances');
            await panel.getByRole('button', { name: 'Settle up' }).click();
            await dialog(page, 'Choose a debt')
                .getByRole('button', { name: new RegExp(escapeRegExp('E2E A')) })
                .click();
            const payment = dialog(page, 'Record payment');
            await payment.getByLabel('Payment amount').fill('7.5');
            await payment.getByRole('button', { name: 'Record payment' }).click();
            await expect(page.getByRole('dialog', { name: 'Record payment' })).toBeHidden();
        },
    ),
    'activity-details.loading': recipe(async context => {
        await openActivityDetails(context, dinnerRow(context.page));
        await context.waitForHeldRequest();
    }),
    'activity-details.error': recipe(async context => {
        await openActivityDetails(context, dinnerRow(context.page));
        await expectVisibleText(context.page, "Couldn't load activity updates");
    }),
    'activity-details.offline': recipe(async context => {
        await openActivityDetails(context, dinnerRow(context.page));
        await expectVisibleText(context.page, 'Updates related to this activity');
    }),
    'activity-details.unavailable': recipe(visitSignedIn),
    'activity-details.invalid-id': recipe(visitSignedIn),
    'activity-details.long-content': recipe(context =>
        openActivityDetails(
            context,
            context.page.getByRole('link').filter({ hasText: /E2E very long expense description/ }),
        ),
    ),

    friends: showsText('E2E B'),
    'friends.empty': showsText('Add friends to track shared expenses and settle up easily.'),
    'friends.settled': showsText('E2E B'),
    'friends.loading': holdsRead(),
    'friends.error': showsLoadError(),
    'friends.offline': showsText('E2E B'),
    'friends.long-content': showsText(LONG_MEMBER),

    settings: showsText('Profile info'),
    'settings.loading': holdsRead(),
    'settings.offline': showsText('Profile info'),
    'settings.long-content': showsText('Profile info'),

    'not-found': recipe(visit),
    'not-found.signed-in': recipe(visitSignedIn),
    'app.backend-unavailable': recipe(async context => {
        await visit(context);
        await expect(visibleOne(context.page.getByText('ChipIn will be back shortly'))).toBeVisible(
            { timeout: ERROR_STATE_TIMEOUT },
        );
    }),
    'app.update-required': recipe(async context => {
        await visit(context);
        await expect(visibleOne(context.page.getByText('App update required'))).toBeVisible({
            timeout: ERROR_STATE_TIMEOUT,
        });
    }),

    'modal.sign-in': recipe(async context => {
        await visit(context);
        await clickButton(context.page, 'Sign in');
        await expect(dialog(context.page)).toBeVisible();
    }),
    'modal.create-group': recipe(async context => {
        await visitSignedIn(context);
        await clickButton(context.page, /^Create group\b/);
        await expect(dialog(context.page, 'Create new group')).toBeVisible();
    }),
    'modal.create-group.validation': recipe(async context => {
        await visitSignedIn(context);
        await clickButton(context.page, /^Create group\b/);
        const form = dialog(context.page, 'Create new group');
        await form.locator('button[type="submit"]').click();
        await expect(form).toBeVisible();
    }),
    'modal.edit-group': recipe(async context => {
        await openGroupWithGroupsList(context.page, groupId(context));
        await clickButton(context.page, 'Edit group');
        await expect(dialog(context.page, 'Edit group')).toBeVisible();
    }),
    'modal.add-expense': recipe(async context => {
        await visitSignedIn(context);
        await clickButton(context.page, 'Add expense');
        await expect(dialog(context.page, 'Add an expense')).toBeVisible();
    }),
    'modal.add-expense.group': recipe(async context => {
        await openGroupExpenseEditor(context, 'E2E B');
    }),
    'modal.add-expense.split-amounts': recipe(async context => {
        const editor = await openGroupExpenseEditor(context, LONG_MEMBER);
        await editor.getByRole('radio', { name: 'Amounts' }).click();
    }),
    'modal.add-expense.validation': recipe(async context => {
        const editor = await openGroupExpenseEditor(context, 'E2E B');
        await editor.getByRole('button', { name: 'Add expense', exact: true }).click();
        await expect(editor).toBeVisible();
    }),
    'modal.add-expense.offline': recipe(async context => {
        await openGroupExpenseEditor(context, 'E2E B');
    }),
    'modal.edit-expense': recipe(async context => {
        await openActivityDetails(context, dinnerRow(context.page));
        await clickDetailsAction(context.page, 'Update');
        await expect(dialog(context.page, 'Edit expense')).toBeVisible();
    }),
    'modal.delete-expense': recipe(async context => {
        await openActivityDetails(context, dinnerRow(context.page));
        await clickDetailsAction(context.page, 'Delete');
        await expect(dialog(context.page, 'Delete entry?')).toBeVisible();
    }),
    'modal.settle-up.choose-debt': recipe(async context => {
        const panel = await openGroupTab(context.page, groupId(context), 'Balances');
        await panel.getByRole('button', { name: 'Settle up' }).click();
        await expect(dialog(context.page, 'Choose a debt')).toBeVisible();
    }),
    'modal.settle-up.record-payment': recipe(async context => {
        const panel = await openGroupTab(context.page, groupId(context), 'Balances');
        await panel.getByRole('button', { name: 'Settle up' }).click();
        await dialog(context.page, 'Choose a debt')
            .getByRole('button', { name: new RegExp(escapeRegExp('E2E A')) })
            .click();
        await expect(dialog(context.page, 'Record payment')).toBeVisible();
    }),
    'modal.settle-up.friend': friendMenuDialog('E2E A', 'Settle up'),
    'modal.invite-qr.group': settingsDialog(/Show QR code/),
    'modal.invite-qr.friend': recipe(async context => {
        await visitSignedIn(context);
        await clickButton(context.page, /Show QR code/);
        await expect(dialog(context.page)).toBeVisible();
    }),
    'modal.remove-friend': friendMenuDialog('E2E B', 'Remove friend'),
    'modal.kick-member': settingsDialog('Kick'),
    'modal.leave-group': settingsDialog('Leave group'),
    'modal.leave-group.owner': settingsDialog('Leave group'),
    'modal.delete-group': settingsDialog('Remove group'),
    'modal.user-avatar': recipe(async context => {
        await visitSignedIn(context);
        await clickButton(context.page, 'Change photo');
        await expect(dialog(context.page, 'Update profile photo')).toBeVisible();
    }),

    'site.home': SITE_ROW,
    'site.home.ru': SITE_ROW,
    'site.privacy': SITE_ROW,
    'site.privacy.ru': SITE_ROW,
    'site.terms': SITE_ROW,
    'site.terms.ru': SITE_ROW,
    'site.not-found': SITE_ROW,
    'site.join-friend': SITE_ROW,
    'site.join-friend.invalid': SITE_ROW,
    'site.join-group': SITE_ROW,
    'site.join-group.invalid': SITE_ROW,
};
