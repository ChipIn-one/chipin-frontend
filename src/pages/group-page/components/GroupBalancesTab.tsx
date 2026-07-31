import { LucideUserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Avatar, Button, Card, Flex, Text } from '@radix-ui/themes';

import type { Group } from 'api/chipin.types';
import { buildGroupInviteLink } from 'helpers/url';
import { useUsersStore } from 'store/users-store';

import BalanceSummaryText from 'basics/BalanceSummaryText';
import { NoGroupMembersEmptyState } from 'basics/empty-states';
import GroupRoleBadge from 'basics/GroupRoleBadge';
import { SettleUpModal } from 'components/modals';

interface Props {
    group: Group;
}

const GroupBalancesTab = ({ group }: Props) => {
    const { t } = useTranslation('group');
    const user = useUsersStore(s => s.user);

    const otherMembers = group.members.filter(member => member.user.id !== user?.id);
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
            {otherMembers.map(member => {
                const balances = Object.values(member.balancesByCurrency);

                return (
                    <Card key={member.user.id} size="2">
                        <Flex
                            direction={{ initial: 'column', xs: 'row' }}
                            align={{ initial: 'stretch', xs: 'center' }}
                            justify="between"
                            gap="4"
                        >
                            <Flex align="center" gap="3">
                                <Avatar
                                    size="3"
                                    radius="full"
                                    src={member.user.picture || ''}
                                    alt={member.user.displayName}
                                    fallback={member.user.displayName?.[0]}
                                />
                                <Flex direction="column" gap="1">
                                    <Flex align="center" gap="2">
                                        <Text weight="medium" size="2">
                                            {member.user.displayName}
                                        </Text>
                                        <GroupRoleBadge
                                            isOwner={member.user.id === group.creator.id}
                                        />
                                    </Flex>
                                    <BalanceSummaryText
                                        entries={balances}
                                        size="1"
                                        align="left"
                                    />
                                </Flex>
                            </Flex>

                            <SettleUpModal
                                source="group"
                                group={group}
                                memberId={member.user.id}
                            />
                        </Flex>
                    </Card>
                );
            })}
        </Flex>
    );
};

export default GroupBalancesTab;
