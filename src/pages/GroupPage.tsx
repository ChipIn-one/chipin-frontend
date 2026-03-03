import { useEffect } from 'react';
import {
    LucideCopy,
    LucideInfo,
    LucideSettings,
    LucideUserRoundPen,
    LucideUserRoundX,
    LucideUsers,
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';

import {
    Avatar,
    Box,
    Button,
    Card,
    Container,
    Flex,
    Grid,
    Heading,
    Separator,
    Skeleton,
    Text,
} from '@radix-ui/themes';

import { buildGroupInviteLink } from 'helpers/url';
import { useGroupsStore } from 'store/groupsStore';

import ActivityTemplate from 'components/ActivityTemplate';
import GroupAvatar from 'components/GroupAvatar';
import CreateUpdateGroupModal from 'components/Modal/CreateUpdateGroupModal';
import GroupQRModal from 'components/Modal/GroupQRModal';
import RemoveGroupModal from 'components/Modal/RemoveGroupModal';
import MobileNavBar from 'components/Navs/MobileNavBar';
import UsersRow from 'components/UsersRow';

const GroupPage = () => {
    const { selectedGroup, isLoadingGroup, fetchSetGroupById } = useGroupsStore();
    const { groupId } = useParams<{ groupId: string }>();

    useEffect(() => {
        fetchSetGroupById(groupId);
    }, [groupId, fetchSetGroupById]);

    if (!groupId || !selectedGroup || (!selectedGroup && !isLoadingGroup)) {
        return (
            <Container size="4" py="6">
                <Card>
                    <Text color="red">No group id or group not found</Text>
                </Card>
            </Container>
        );
    }

    const inviteLink = buildGroupInviteLink({ inviteToken: selectedGroup.inviteToken });

    const onCopyGroupLink = async () => {
        if (!inviteLink) {
            toast.error('Invite link is not ready yet');
            return;
        }

        try {
            await navigator.clipboard.writeText(inviteLink);
            toast.success('Group invite link copied');
        } catch (error) {
            console.error('Failed to copy invite link', error);
            toast.error('Failed to copy link');
        }
    };

    return (
        <Container size="4" pb={{ initial: '9', sm: '6' }}>
            <Grid columns="3" gap="6">
                <Box
                    gridColumn={{
                        initial: 'span 3',
                        sm: 'span 1',
                    }}
                    mb="6"
                >
                    <Card size="4">
                        <Flex direction="column" gap="4">
                            <Flex align="center" gap="3">
                                <Skeleton loading={isLoadingGroup}>
                                    {selectedGroup ? (
                                        <GroupAvatar group={selectedGroup} size="6" />
                                    ) : (
                                        <Avatar size="4" fallback={<LucideUsers />} />
                                    )}
                                </Skeleton>

                                <Flex direction="column" gap="2" minWidth="0" flexGrow="1">
                                    <Skeleton loading={isLoadingGroup}>
                                        <Heading size="6">
                                            {selectedGroup?.name || 'Loading group...'}
                                        </Heading>
                                    </Skeleton>

                                    {selectedGroup && (
                                        <Flex align="center" justify="between" gap="2" wrap="wrap">
                                            <UsersRow members={selectedGroup.members} max={4} />
                                            <Button variant="ghost" size="1">
                                                <LucideSettings size={20} />
                                            </Button>
                                        </Flex>
                                    )}
                                </Flex>
                            </Flex>

                            {selectedGroup?.description && (
                                <>
                                    <Separator size="4" />
                                    <Flex direction="column" gap="2">
                                        <Skeleton loading={isLoadingGroup}>
                                            <Text>
                                                {selectedGroup?.description ||
                                                    'No description yet. Add one in group settings.'}
                                            </Text>
                                        </Skeleton>
                                    </Flex>
                                </>
                            )}
                        </Flex>
                    </Card>

                    <Card size="4" mt="6">
                        <Flex direction="column" gap="3">
                            <Flex align="center" gap="2">
                                <LucideSettings />
                                <Text weight="medium">Group actions</Text>
                            </Flex>

                            <Flex
                                direction={{ initial: 'column', sm: 'row', md: 'column' }}
                                gap="3"
                            >
                                <GroupQRModal qrLink={inviteLink} />

                                <Button
                                    variant="solid"
                                    size="3"
                                    style={{ width: '100%' }}
                                    onClick={onCopyGroupLink}
                                    disabled={!inviteLink}
                                >
                                    <LucideCopy />
                                    Copy group link
                                </Button>

                                <CreateUpdateGroupModal type="update">
                                    <Button variant="solid" size="3" style={{ width: '100%' }}>
                                        <LucideUserRoundPen />
                                        Update group
                                    </Button>
                                </CreateUpdateGroupModal>

                                <RemoveGroupModal>
                                    <Button
                                        variant="solid"
                                        color="red"
                                        size="3"
                                        style={{ width: '100%' }}
                                    >
                                        <LucideUserRoundX />
                                        Remove group
                                    </Button>
                                </RemoveGroupModal>
                            </Flex>

                            <Flex align="start" gap="2">
                                <LucideInfo size={16} />
                                <Text size="2" color="gray">
                                    Share invite link with trusted people only.
                                </Text>
                            </Flex>
                        </Flex>
                    </Card>
                </Box>

                <Box
                    gridColumn={{
                        initial: 'span 3',
                        sm: 'span 2',
                    }}
                >
                    <ActivityTemplate isLoading={false} />
                </Box>
            </Grid>

            <MobileNavBar />
        </Container>
    );
};

export default GroupPage;
