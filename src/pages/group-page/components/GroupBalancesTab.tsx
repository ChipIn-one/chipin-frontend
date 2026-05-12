import { LucideArrowLeftRight, LucideUserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Avatar, Button, Card, Flex, Text } from '@radix-ui/themes';

import { Group } from 'api/chipin.types';
import { buildGroupInviteLink } from 'helpers/url';
import { useUsersStore } from 'store/usersStore';

import { NoGroupMembersEmptyState } from 'basics/empty-states';
import GroupRoleBadge from 'basics/GroupRoleBadge';
import OwedStatusText from 'basics/OwedStatusText';

interface Props {
    group: Group;
}

/**
 * Placeholder balances tab — real balance data comes from the API (not yet wired).
 * Renders members with stub zero balances, ready to be replaced with real data.
 */
const GroupBalancesTab = ({ group }: Props) => {
    const { t } = useTranslation('group');
    const user = useUsersStore(s => s.user);

    const otherMembers = group.members.filter(member => member.id !== user?.id);
    const inviteLink = buildGroupInviteLink({ inviteToken: group.inviteToken });

    if (otherMembers.length === 0) {
        return (
            <NoGroupMembersEmptyState
                action={
                    <Button size="2" variant="soft" color="teal" asChild>
                        <a href={inviteLink} target="_blank" rel="noreferrer">
                            <LucideUserPlus size={14} />
                            {t('page.membersTab.invitePeople')}
                        </a>
                    </Button>
                }
            />
        );
    }

    return (
        <Flex direction="column" gap="2">
            {otherMembers.map(member => (
                <Card key={member.id} size="2">
                    <Flex align="center" justify="between" gap="3">
                        <Flex align="center" gap="3">
                            <Avatar
                                size="3"
                                radius="full"
                                src={member.picture || ''}
                                alt={member.displayName}
                                fallback={member.displayName?.[0]}
                            />
                            <Flex direction="column" gap="1">
                                <Flex align="center" gap="2">
                                    <Text weight="medium" size="2">
                                        {member.displayName}
                                    </Text>
                                    <GroupRoleBadge isOwner={member.id === group.creator.id} />
                                </Flex>
                                <OwedStatusText
                                    amount={0}
                                    currencyCode="USD"
                                    size="1"
                                    align="left"
                                />
                            </Flex>
                        </Flex>

                        <Flex align="center" gap="2">
                            <Button size="1" color="green" variant="soft">
                                <LucideArrowLeftRight size={13} />
                                {t('page.balances.settled')}
                            </Button>
                        </Flex>
                    </Flex>
                </Card>
            ))}
        </Flex>
    );
};

export default GroupBalancesTab;
