import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import { Card, Flex, Text } from '@radix-ui/themes';

import { useExpenseModalStore } from 'store/expenseModalStore';

const scopeIsGroup = (state: { editContext: { groupId?: string } | null }) =>
    Boolean(state.editContext?.groupId);

const ExpenseScopeContext = () => {
    const { t } = useTranslation('group');
    const { groupName, scope, usersLabel } = useExpenseModalStore(
        useShallow(state => {
            const includedUsers: string[] = [];

            for (const group of state.source.groups) {
                if (scopeIsGroup(state) && group.id === state.editContext?.groupId) {
                    for (const member of group.members) {
                        if (state.includedParticipantIds[member.id]) {
                            includedUsers.push(member.displayName);
                        }
                    }
                    break;
                }
            }

            if (!scopeIsGroup(state)) {
                if (state.source.currentUser && state.includedParticipantIds[state.source.currentUser.id]) {
                    includedUsers.push(state.source.currentUser.displayName);
                }

                for (const friend of state.source.knownFriends) {
                    if (state.includedParticipantIds[friend.id]) {
                        includedUsers.push(friend.displayName);
                    }
                }
            }

            return {
                scope: scopeIsGroup(state) ? 'group' : 'friends',
                groupName: state.editContext?.groupName ?? '',
                usersLabel: includedUsers.join(', '),
            };
        }),
    );

    return (
        <Card>
            <Flex direction="column" gap="1">
                <Text size="2" weight="bold" color="gray">
                    {scope === 'group'
                        ? t('expenses.modal.scope.group', { groupName })
                        : t('expenses.modal.scope.friends', { users: usersLabel })}
                </Text>
            </Flex>
        </Card>
    );
};

export default ExpenseScopeContext;
