import { useEffect } from 'react';
import { t } from 'i18next';
import {
    LucideArrowLeftRight,
    LucideCopy,
    LucideInfo,
    LucideLogOut,
    LucidePlus,
    LucideSettings,
    LucideSlidersHorizontal,
    LucideUserRoundPen,
    LucideUserRoundX,
    LucideUsers,
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import styled from 'styled-components';

import {
    AspectRatio,
    Avatar,
    Badge,
    Box,
    Button,
    Card,
    Container,
    Flex,
    Grid,
    Heading,
    IconButton,
    Inset,
    Separator,
    Skeleton,
    Text,
} from '@radix-ui/themes';

import { buildGroupInviteLink } from 'helpers/url';
import { useGroupsStore } from 'store/groupsStore';
import { selectGroupDataFetched, selectGroupDataLoading } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

import Image from 'basics/Image';
import DashBoardSummary from 'components/DashboardSummary';
import GroupAvatar from 'components/GroupAvatar';
import GroupsCards from 'components/GroupsCards';
import GroupsSectionHeader from 'components/GroupsSectionHeader';
import { AddExpenseModal, CreateUpdateGroupModal, LeaveGroupModal } from 'components/Modal';
import GroupQRModal from 'components/Modal/GroupQRModal';
import RemoveGroupModal from 'components/Modal/RemoveGroupModal';
import MobileNavBar from 'components/Navs/MobileNavBar';
import UsersRow from 'components/UsersRow';
import { ActivityFeedSkeleton } from 'features/activity';

const CoverWrapper = styled(Box)`
    position: relative;
    overflow: hidden;
`;

const CoverGradient = styled(Box)`
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.68) 0%, transparent 55%);
    pointer-events: none;
`;

const CoverInfo = styled(Box)`
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
`;

const CoverTopActions = styled(Box)`
    position: absolute;
    top: var(--space-3);
    right: var(--space-3);
`;

const GroupPage = () => {
    const { groups, selectedGroup, fetchSetGroupById } = useGroupsStore();
    const isGroupDataLoading = useLoadingStore(selectGroupDataLoading);
    const isGroupDataFetched = useLoadingStore(selectGroupDataFetched);
    const { groupId } = useParams<{ groupId: string }>();

    useEffect(() => {
        fetchSetGroupById(groupId);
    }, [groupId, fetchSetGroupById]);

    if (!groupId) {
        return (
            <Container size="4" py="6">
                <Card>
                    <Text color="red">No group id or group not found</Text>
                </Card>
            </Container>
        );
    }

    if (!selectedGroup) {
        if (!isGroupDataFetched) {
            return null;
        }

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
            toast.error(t('toasts:group.inviteLinkNotReady'));
            return;
        }

        try {
            await navigator.clipboard.writeText(inviteLink);
            toast.success(t('toasts:group.inviteLinkCopied'));
        } catch (error) {
            console.error('Failed to copy invite link', error);
            toast.error(t('toasts:group.inviteLinkCopyError'));
        }
    };

    return (
        <Container size="4" pb={{ initial: '9', sm: '4' }}>
            <Grid columns="3" gap="6">
                <Box
                    gridColumn={{
                        initial: 'span 3',
                        sm: 'span 1',
                    }}
                    mb="6"
                >
                    <DashBoardSummary />

                    <GroupsSectionHeader
                        mt="4"
                        mb="4"
                        label={t('dashboard:groups.otherTitle')}
                        isLoading={isGroupDataLoading}
                    />
                    <GroupsCards groups={groups.filter(group => group.id !== selectedGroup?.id)} />
                    <Card size="4">
                        <Flex direction="column" gap="3">
                            <Flex align="center" gap="2">
                                <LucideSettings />
                                <Text weight="medium">Group actions</Text>
                            </Flex>

                            <Flex
                                direction={{ initial: 'column', sm: 'row', md: 'column' }}
                                gap="3"
                            >
                                <GroupQRModal qrLink={inviteLink} groupName={selectedGroup?.name} />

                                <Button
                                    variant="solid"
                                    size="3"
                                    onClick={onCopyGroupLink}
                                    disabled={!inviteLink}
                                >
                                    <LucideCopy />
                                    Copy group link
                                </Button>

                                <CreateUpdateGroupModal type="update">
                                    <Button variant="solid" size="3">
                                        <LucideUserRoundPen />
                                        Update group
                                    </Button>
                                </CreateUpdateGroupModal>

                                <RemoveGroupModal>
                                    <Button variant="solid" color="red" size="3">
                                        <LucideUserRoundX />
                                        Remove group
                                    </Button>
                                </RemoveGroupModal>

                                <LeaveGroupModal>
                                    <Button variant="solid" color="orange" size="3">
                                        <LucideLogOut />
                                        Leave group
                                    </Button>
                                </LeaveGroupModal>
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
                    <Card size="4" mb="6">
                        <Inset clip="border-box" side="top" pb="current">
                            <CoverWrapper>
                                <AspectRatio ratio={16 / 4}>
                                    <Image
                                        src={
                                            selectedGroup?.coverUrl ||
                                            'https://www.virginaustralia.com/content/dam/vaa/images/destinations/bali/best-islands-near-bali/vaa-1440x620-best-islands-near-bali.jpg/jcr:content/renditions/vaacore.web.1920.0.jpg'
                                        }
                                        alt={`${selectedGroup?.name} cover`}
                                        width="100%"
                                    />
                                </AspectRatio>
                                <CoverGradient />
                                <CoverTopActions>
                                    <CreateUpdateGroupModal type="update">
                                        <IconButton variant="ghost" color="gray" size="2">
                                            <LucideSlidersHorizontal size={18} />
                                        </IconButton>
                                    </CreateUpdateGroupModal>
                                </CoverTopActions>

                                <CoverInfo p="4">
                                    <Flex gap="2" align="center">
                                        <Skeleton loading={isGroupDataLoading}>
                                            {selectedGroup ? (
                                                <GroupAvatar group={selectedGroup} size="5" />
                                            ) : (
                                                <Avatar size="5" fallback={<LucideUsers />} />
                                            )}
                                        </Skeleton>
                                        <Flex gap="1" direction="column">
                                            <Box>
                                                <Skeleton loading={isGroupDataLoading}>
                                                    <Badge size="2" color="cyan" variant="surface">
                                                        {selectedGroup?.members.length ?? 0} members
                                                    </Badge>
                                                </Skeleton>
                                            </Box>
                                            <Box>
                                                <Skeleton loading={isGroupDataLoading}>
                                                    <Heading size="6">
                                                        {selectedGroup?.name || 'Loading group...'}
                                                    </Heading>
                                                </Skeleton>
                                            </Box>
                                        </Flex>
                                    </Flex>
                                </CoverInfo>
                            </CoverWrapper>
                        </Inset>
                        <Flex direction="column" gap="4">
                            {selectedGroup && (
                                <Flex align="center" justify="between" gap="2" wrap="wrap">
                                    <UsersRow members={selectedGroup.members} max={10} size="2" />
                                    <Flex gap="2" align="center">
                                        <AddExpenseModal>
                                            <Button variant="outline" size="2">
                                                <LucidePlus size={15} />
                                                Add expense
                                            </Button>
                                        </AddExpenseModal>
                                        <Button size="2" color="green">
                                            <LucideArrowLeftRight size={15} />
                                            Settle up
                                        </Button>
                                    </Flex>
                                </Flex>
                            )}
                            {selectedGroup?.description && (
                                <>
                                    <Separator size="4" />
                                    <Flex direction="column" gap="2">
                                        <Skeleton loading={isGroupDataLoading}>
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

                    <ActivityFeedSkeleton isExpensesOnly />
                </Box>
            </Grid>

            <MobileNavBar />
        </Container>
    );
};

export default GroupPage;
