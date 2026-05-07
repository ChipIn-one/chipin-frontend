import { useState } from 'react';
import {
    LucideCheck,
    LucideLink2,
    LucideLogOut,
    LucideQrCode,
    LucideTrash2,
    LucideUserMinus,
    LucideUserPlus,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import { Avatar, Badge, Box, Button, Card, Flex, Separator, Switch, Text } from '@radix-ui/themes';
import { useCopyToClipboard } from '@uidotdev/usehooks';

import { ApiGroup } from 'api/chipin.types';
import { SECOND } from 'constants/time';
import { buildGroupInviteLink } from 'helpers/url';
import { useUsersStore } from 'store/usersStore';

import GroupRoleBadge from 'basics/GroupRoleBadge';
import { BaseModal, KickGroupMemberModal, LeaveGroupModal } from 'components/modals';
import RemoveGroupModal from 'components/modals/RemoveGroupModal';
import OfflineQRCode from 'components/OfflineQRCode';

const COPY_RESET_DELAY_MS = 2 * SECOND;

/**
 * A plain button reset used as the interactive wrapper for settings-list rows.
 * Justified as a styled component because `cursor`, `background-none`, and
 * border/padding resets have no Radix prop equivalents.
 */
const SettingsRowButton = styled.button`
    display: block;
    width: 100%;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font: inherit;
    color: inherit;
    text-align: left;
`;

interface Props {
    group: ApiGroup;
}

const GroupSettingsTab = ({ group }: Props) => {
    const { t } = useTranslation(['group', 'common']);
    const { user } = useUsersStore();
    const [, copyFn] = useCopyToClipboard();
    const [isCopied, setIsCopied] = useState(false);

    const isUserOwner = user?.id === group.creator.id;

    const inviteLink = buildGroupInviteLink({ inviteToken: group.inviteToken });

    const handleCopyLink = async () => {
        await copyFn(inviteLink);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), COPY_RESET_DELAY_MS);
    };

    return (
        <Flex direction="column" gap="5">
            {/* ── INVITE section ── */}
            <Flex direction="column" gap="2">
                <Text size="1" color="gray" weight="medium">
                    {t('group:page.settings.inviteSection')}
                </Text>

                {/* Copy invite link row */}
                <Card asChild size="2">
                    <SettingsRowButton onClick={handleCopyLink}>
                        <Flex align="center" gap="3" p="4">
                            <Avatar
                                size="3"
                                radius="medium"
                                variant="soft"
                                color="indigo"
                                fallback={
                                    isCopied ? <LucideCheck size={16} /> : <LucideLink2 size={16} />
                                }
                            />
                            <Flex direction="column" gap="1" flexGrow="1" overflow="hidden">
                                <Text size="2" weight="medium">
                                    {isCopied
                                        ? t('common:copy.copied')
                                        : t('group:page.settings.copyLinkTitle')}
                                </Text>
                                <Text size="1" color="gray" truncate>
                                    {inviteLink}
                                </Text>
                            </Flex>
                        </Flex>
                    </SettingsRowButton>
                </Card>

                {/* Show QR code row */}
                <BaseModal
                    title={t('group:qr.title')}
                    description=""
                    content={<OfflineQRCode url={inviteLink} size="large" />}
                    triggerElement={
                        <Card asChild size="2">
                            <SettingsRowButton>
                                <Flex align="center" gap="3" p="4">
                                    <Avatar
                                        size="3"
                                        radius="medium"
                                        variant="soft"
                                        color="violet"
                                        fallback={<LucideQrCode size={16} />}
                                    />
                                    <Flex direction="column" gap="1">
                                        <Text size="2" weight="medium">
                                            {t('group:page.settings.showQRTitle')}
                                        </Text>
                                        <Text size="1" color="gray">
                                            {t('group:page.settings.showQRSubtitle')}
                                        </Text>
                                    </Flex>
                                </Flex>
                            </SettingsRowButton>
                        </Card>
                    }
                />

                {/* Add people row (stub) */}
                <Card size="2">
                    <Flex align="center" gap="3">
                        <Avatar
                            size="3"
                            radius="medium"
                            variant="soft"
                            color="green"
                            fallback={<LucideUserPlus size={16} />}
                        />
                        <Flex direction="column" gap="1">
                            <Text size="2" weight="medium">
                                {t('group:page.settings.addPeopleTitle')}
                            </Text>
                            <Text size="1" color="gray">
                                {t('group:page.settings.addPeopleSubtitle')}
                            </Text>
                        </Flex>
                    </Flex>
                </Card>
            </Flex>

            {/* ── MEMBERS section ── */}
            <Flex direction="column" gap="2">
                <Text size="1" color="gray" weight="medium">
                    {t('group:page.settings.membersSection')}
                </Text>

                {group.members.map(member => {
                    const isCurrentUser = member.id === user?.id;
                    const isOwner = member.id === group.creator.id;

                    return (
                        <Card key={member.id} size="2">
                            <Flex align="center" gap="3" justify="between">
                                <Flex align="center" gap="3">
                                    <Avatar
                                        size="3"
                                        radius="full"
                                        src={member.picture || ''}
                                        alt={member.displayName}
                                        fallback={member.displayName?.[0]}
                                    />
                                    <Flex direction="column" gap="1">
                                        <Flex align="center" gap="2" wrap="wrap">
                                            <Text weight="medium" size="2">
                                                {member.displayName}
                                            </Text>
                                            <GroupRoleBadge isOwner={isOwner} />
                                            {isCurrentUser && (
                                                <Badge size="1" color="teal" variant="soft">
                                                    {t('group:page.membersTab.you')}
                                                </Badge>
                                            )}
                                        </Flex>
                                        <Text size="1" color="gray" truncate>
                                            {member.email}
                                        </Text>
                                    </Flex>
                                </Flex>
                                {isUserOwner && !isCurrentUser && (
                                    <KickGroupMemberModal member={member}>
                                        <Button variant="soft" color="orange" size="1">
                                            <LucideUserMinus size={13} />
                                            {t('common:buttons.kickMember')}
                                        </Button>
                                    </KickGroupMemberModal>
                                )}
                            </Flex>
                        </Card>
                    );
                })}
            </Flex>

            {/* ── SETTINGS section ── */}
            <Flex direction="column" gap="2">
                <Text size="1" color="gray" weight="medium">
                    {t('group:page.settings.settingsSection')}
                </Text>

                <Card size="2">
                    <Flex align="center" justify="between" gap="3">
                        <Flex direction="column" gap="1">
                            <Text size="2" weight="medium">
                                {t('group:page.settings.simplifyDebtsTitle')}
                            </Text>
                            <Text size="1" color="gray">
                                {t('group:page.settings.simplifyDebtsSubtitle')}
                            </Text>
                        </Flex>
                        <Switch size="2" disabled />
                    </Flex>
                </Card>
            </Flex>

            {/* ── Danger actions ── */}
            <Flex direction="column" gap="1">
                <Separator size="4" mb="1" />

                <LeaveGroupModal>
                    <Box width="100%" asChild>
                        <Button variant="ghost" color="orange" size="3">
                            <LucideLogOut size={16} />
                            {t('common:buttons.leaveGroup')}
                        </Button>
                    </Box>
                </LeaveGroupModal>

                <Separator size="4" my="1" />

                <RemoveGroupModal>
                    <Box width="100%" asChild>
                        <Button variant="ghost" color="red" size="3">
                            <LucideTrash2 size={16} />
                            {t('common:buttons.removeGroup')}
                        </Button>
                    </Box>
                </RemoveGroupModal>
            </Flex>
        </Flex>
    );
};

export default GroupSettingsTab;
