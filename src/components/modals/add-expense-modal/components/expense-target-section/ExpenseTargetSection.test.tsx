import { ThemeProvider } from 'styled-components';
import { beforeEach, expect, test } from 'vitest';

import { render, screen } from '@testing-library/react';

import { EXPENSE_SPLIT_MODES } from 'constants/chipin';
import { lightThemeStyled } from 'constants/styled-themes';
import type {
    ExpenseModalEditInitialization,
    ExpenseParticipant,
} from 'store/expenseModalStore';
import { useExpenseModalStore } from 'store/expenseModalStore';

import ExpenseTargetSection from './ExpenseTargetSection';

import 'i18n/index';

const currentUser = {
    id: 'user-1',
    displayName: 'Alex',
    picture: null,
} satisfies ExpenseParticipant;

const friend = {
    id: 'user-2',
    displayName: 'Sam',
    picture: null,
} satisfies ExpenseParticipant;

const groupMember = {
    id: 'user-3',
    displayName: 'Taylor',
    picture: null,
} satisfies ExpenseParticipant;

const getEditInitialization = (
    targetMode: 'group' | 'friends',
): ExpenseModalEditInitialization => ({
    mode: 'edit',
    source: {
        context: 'dashboard',
        currentUser,
        defaultCurrency: 'USD',
        defaultCategory: 'food',
        skipCategory: false,
        groups: [
            {
                id: 'group-1',
                name: 'Weekend Trip',
                members: [currentUser, groupMember],
            },
        ],
        knownFriends: [friend],
    },
    targetMode,
    groupId: targetMode === 'group' ? 'group-1' : '',
    selectedFriendId: targetMode === 'friends' ? friend.id : '',
    description: 'Dinner',
    amount: '30',
    currency: 'USD',
    category: 'food',
    paidById: currentUser.id,
    splitMode: EXPENSE_SPLIT_MODES.EQUAL,
    percentShares: {},
    amountShares: {},
    shareWeights: {},
    includedParticipantIds:
        targetMode === 'group'
            ? { [currentUser.id]: true, [groupMember.id]: true }
            : { [currentUser.id]: true, [friend.id]: true },
    isPercentManuallyEdited: false,
    editContext: {
        entryId: 'entry-1',
        groupId: targetMode === 'group' ? 'group-1' : undefined,
        groupName: targetMode === 'group' ? 'Weekend Trip' : null,
        original: {
            description: 'Dinner',
            amount: 30,
            payerId: currentUser.id,
            participantIds:
                targetMode === 'group'
                    ? [currentUser.id, groupMember.id]
                    : [currentUser.id, friend.id],
            currency: 'USD',
            category: 'food',
            subcategory: null,
            sharingMode: { type: 'AUTO' },
        },
    },
});

const renderTargetSection = () => {
    render(
        <ThemeProvider theme={lightThemeStyled}>
            <ExpenseTargetSection />
        </ThemeProvider>,
    );
};

beforeEach(() => {
    useExpenseModalStore.getState().reset();
});

test('shows immutable group scope and keeps payer editing in edit mode', () => {
    useExpenseModalStore.getState().initializeEdit(getEditInitialization('group'));

    renderTargetSection();

    expect(screen.getByText('Group expense: Weekend Trip')).not.toBeNull();
    expect(screen.getByText('Paid by')).not.toBeNull();
    expect(screen.queryByText('Friends', { selector: '[data-state]' })).toBeNull();
    expect(screen.queryByText('Group', { selector: '[data-state]' })).toBeNull();
});

test('shows immutable P2P participants and keeps payer editing in edit mode', () => {
    useExpenseModalStore.getState().initializeEdit(getEditInitialization('friends'));

    renderTargetSection();

    expect(screen.getByText('P2P expense with Alex, Sam')).not.toBeNull();
    expect(screen.getByText('Paid by')).not.toBeNull();
    expect(screen.queryByText('Friends', { selector: '[data-state]' })).toBeNull();
    expect(screen.queryByText('Group', { selector: '[data-state]' })).toBeNull();
});
