export type ChangelogRelease = {
    version: string;
    date: string;
    changes: string[];
};

export const releases: ChangelogRelease[] = [
    {
        version: 'Unreleased',
        date: '2026-07-03',
        changes: [
            'Added activity detail actions for ledger entries.',
            'Updated activity feeds so summaries and subevent links appear only in dashboard and group contexts.',
            'Replaced the activity details header with the parent activity card and clearer actions.',
            'Added dedicated skeletons for expense and settlement activity history.',
            'Prevented the activity history parent card from flashing during child feed loading.',
            'Added rendering for reversed expense and settlement activity events.',
        ],
    },
];
