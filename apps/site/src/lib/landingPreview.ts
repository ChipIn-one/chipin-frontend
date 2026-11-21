import type { IconName } from './icons';

// The sample group of the landing "Group page preview" (the app's group-page-preview/internal/
// constants.ts). The app shows member photos and a cover photo from external hosts; the site CSP
// allows images from its own origin only, so the site shows the members' initials and the cover
// gradient without the photo.

/** The preview members: their initials are shown, the count is in the "4 members" badge text. */
const PREVIEW_MEMBERS = ['Anna', 'Luis', 'Mia', 'Noah'] as const;

interface PreviewExpense {
    key: 'hotel' | 'dinner' | 'tickets';
    /** EUR paid. */
    amount: number;
    /** EUR the viewer is owed (positive) or owes (negative). */
    debt: number;
    icon: IconName;
    /** `you` or a member name. */
    payer: string;
}

const PREVIEW_EXPENSES: readonly PreviewExpense[] = [
    { key: 'hotel', amount: 420, debt: 210, icon: 'hotel', payer: 'you' },
    { key: 'dinner', amount: 86, debt: -43, icon: 'utensilsCrossed', payer: 'Aleh' },
    { key: 'tickets', amount: 120, debt: 60, icon: 'trainFront', payer: 'you' },
];

const PREVIEW_CURRENCY = 'EUR';

/** The viewer's net balance in the group: the sum of the debts. */
const PREVIEW_NET_BALANCE = PREVIEW_EXPENSES.reduce((total, expense) => total + expense.debt, 0);

export { PREVIEW_CURRENCY, PREVIEW_EXPENSES, PREVIEW_MEMBERS, PREVIEW_NET_BALANCE };
export type { PreviewExpense };
