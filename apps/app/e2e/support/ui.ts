// UI helpers of the money specs (docs/e2e-tests.md). They avoid layout assumptions: a control that
// exists once per layout (desktop sidebar, mobile bar, header) is taken from the visible ones.
import { expect, type Locator, type Page, type Response } from '@playwright/test';

/** Every name is unique per test, so a leftover of another run can never match. */
export const uniqueSuffix = (): string => crypto.randomUUID().slice(0, 8);

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The whole balance line, e.g. "You are owed 7.5 USD" (basics/BalanceSummaryText), and nothing
 * more: a wrong amount, an extra currency or a missing one fails it.
 */
export const exactBalance = (label: string, amount: string, currency = 'USD'): RegExp =>
    new RegExp(`^${escapeRegExp(label)}\\s+${escapeRegExp(amount)}\\s+${currency}$`);

/** The one control of several layout variants that is shown at this viewport. */
export const visibleOne = (locator: Locator): Locator => locator.filter({ visible: true }).first();

/** The groups list read at session start (`GET /groups`), which the expense editor takes its groups from. */
const isGroupsListRead = (response: Response): boolean =>
    response.request().method() === 'GET' && new URL(response.url()).pathname === '/api/groups';

/**
 * Opens the group page and resolves once the groups list has loaded. The expense editor (create and
 * edit) reads its groups when it opens; opened before this list, it has no group (#718).
 */
export const openGroupWithGroupsList = async (page: Page, groupId: string): Promise<void> => {
    const groupsList = page.waitForResponse(isGroupsListRead);
    await page.goto(`/group/${groupId}`);
    const response = await groupsList;

    expect(response.ok(), 'GET /groups status').toBe(true);
};

/** Selects a tab of the open group page and returns its panel. */
export const selectGroupTab = async (page: Page, tab: string): Promise<Locator> => {
    await page.getByRole('tab', { name: tab }).click();

    return page.getByRole('tabpanel', { name: tab });
};

/** Opens the group page on one of its tabs and returns the tab's panel. */
export const openGroupTab = async (page: Page, groupId: string, tab: string): Promise<Locator> => {
    await page.goto(`/group/${groupId}`);

    return selectGroupTab(page, tab);
};

/**
 * Asserts the Balances panel of a two-member group: the other member is listed and the current
 * user's balance line reads exactly `label amount USD`.
 */
export const expectBalance = async (
    balances: Locator,
    otherMember: string,
    label: 'You are owed' | 'You owe',
    amount: string,
): Promise<void> => {
    await expect(balances.getByText(otherMember)).toBeVisible();
    await expect(balances.getByText(new RegExp(`^${label}\\b`))).toHaveText(
        exactBalance(label, amount),
    );
};

/** Asserts the Balances panel shows no debt with the other member. */
export const expectSettledUp = async (balances: Locator, otherMember: string): Promise<void> => {
    await expect(balances.getByText(otherMember)).toBeVisible();
    // "Settled up" is both the member's status and the disabled settle button's name.
    await expect(balances.getByRole('button', { name: 'Settled up' })).toBeDisabled();
    await expect(balances.getByText(/^You (owe|are owed)\b/)).toHaveCount(0);
};

/** The settings write (entities/users/api/mutations.ts: `PATCH /users/self`). */
const isSelfSettingsWrite = (response: Response): boolean =>
    response.request().method() === 'PATCH' &&
    new URL(response.url()).pathname === '/api/users/self';

/** Clicks and waits until the settings write it causes has succeeded on the server. */
export const clickAndSaveSettings = async (
    page: Page,
    click: () => Promise<void>,
): Promise<void> => {
    const [response] = await Promise.all([page.waitForResponse(isSelfSettingsWrite), click()]);

    expect(response.status(), 'PATCH /users/self status').toBeLessThan(300);
};
