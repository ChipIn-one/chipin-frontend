import { LucideUserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Avatar, Badge, Button, Card, Flex, Text } from '@radix-ui/themes';

import { ApiGroup } from 'api/chipin.types';
import { buildGroupInviteLink } from 'helpers/url';
import { useUsersStore } from 'store/usersStore';

import GroupRoleBadge from 'basics/GroupRoleBadge';

interface Props {
    group: ApiGroup;
}

const GroupMembersTab = ({ group }: Props) => {
    const { t } = useTranslation('group');
    const { user } = useUsersStore();
    const inviteLink = buildGroupInviteLink({ inviteToken: group.inviteToken });

    return (
        <Flex direction="column" gap="2">
            {group.members.map(member => {
                const isCurrentUser = member.id === user?.id;
                const isOwner = member.id === group.creator.id;

                return (
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
                                        <GroupRoleBadge isOwner={isOwner} />
                                        {isCurrentUser && (
                                            <Badge size="1" color="teal" variant="soft">
                                                {t('page.membersTab.you')}
                                            </Badge>
                                        )}
                                    </Flex>
                                    <Text size="1" color="gray" truncate>
                                        {member.email}
                                    </Text>
                                </Flex>
                            </Flex>
                        </Flex>
                    </Card>
                );
            })}

            {inviteLink && (
                <Button variant="ghost" color="gray" size="2" mt="2" asChild>
                    <a href={inviteLink} target="_blank" rel="noreferrer">
                        <LucideUserPlus size={16} />
                        {t('page.membersTab.invitePeople')}
                    </a>
                </Button>
            )}
        </Flex>
    );
};

export default GroupMembersTab;
