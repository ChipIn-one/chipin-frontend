interface ContractParticipantShare {
    userId: string;
    shareAmount: number;
    currency: string;
}

interface ExpectedAutoShare {
    shareAmount: number;
    currency: string;
}

export const hasExpectedAutoShares = (
    shares: readonly ContractParticipantShare[],
    expectedParticipants: ReadonlySet<string>,
    expectedShare: ExpectedAutoShare,
): boolean => {
    if (shares.length !== expectedParticipants.size) {
        return false;
    }

    const seenParticipantIds = new Set<string>();
    for (const share of shares) {
        if (
            !expectedParticipants.has(share.userId) ||
            seenParticipantIds.has(share.userId) ||
            share.shareAmount !== expectedShare.shareAmount ||
            share.currency !== expectedShare.currency
        ) {
            return false;
        }
        seenParticipantIds.add(share.userId);
    }

    return seenParticipantIds.size === expectedParticipants.size;
};
