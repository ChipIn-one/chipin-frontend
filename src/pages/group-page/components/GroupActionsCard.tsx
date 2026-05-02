import {
    LucideInfo,
    LucideLogOut,
    LucideSettings,
    LucideUserRoundPen,
    LucideUserRoundX,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button, Card, Flex, Text } from '@radix-ui/themes';

import { buildGroupInviteLink } from 'helpers/url';
import { useGroupsStore } from 'store/groupsStore';

import CopyButton from 'basics/CopyButton';
import { CreateUpdateGroupModal, LeaveGroupModal } from 'components/modals';
import GroupQRModal from 'components/modals/GroupQRModal';
import RemoveGroupModal from 'components/modals/RemoveGroupModal';

const GroupActionsCard = () => {
    const { t } = useTranslation(['group', 'common']);
    const { selectedGroup } = useGroupsStore();

    const inviteLink = selectedGroup
        ? buildGroupInviteLink({ inviteToken: selectedGroup.inviteToken })
        : null;

    return (
        <Card size="4">
            <Flex direction="column" gap="3">
                <Flex align="center" gap="2">
                    <LucideSettings size={16} />
                    <Text weight="medium">{t('common:buttons.groupActions')}</Text>
                </Flex>

                <Flex direction={{ initial: 'column', sm: 'row', md: 'column' }} gap="3">
                    <GroupQRModal qrLink={inviteLink} groupName={selectedGroup?.name} />

                    <CopyButton value={inviteLink} what={t('common:copyTargets.inviteLink')}>
                        {t('common:buttons.copyGroupLink')}
                    </CopyButton>

                    <CreateUpdateGroupModal type="update">
                        <Button variant="solid" size="3">
                            <LucideUserRoundPen />
                            {t('common:buttons.updateGroup')}
                        </Button>
                    </CreateUpdateGroupModal>

                    <RemoveGroupModal>
                        <Button variant="solid" color="red" size="3">
                            <LucideUserRoundX />
                            {t('common:buttons.removeGroup')}
                        </Button>
                    </RemoveGroupModal>

                    <LeaveGroupModal>
                        <Button variant="solid" color="orange" size="3">
                            <LucideLogOut />
                            {t('common:buttons.leaveGroup')}
                        </Button>
                    </LeaveGroupModal>
                </Flex>

                <Flex align="start" gap="2">
                    <LucideInfo size={16} />
                    <Text size="2" color="gray">
                        {t('group:page.shareWarning')}
                    </Text>
                </Flex>
            </Flex>
        </Card>
    );
};

export default GroupActionsCard;
