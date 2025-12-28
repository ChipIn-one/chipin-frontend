import { useEffect } from 'react';
import { LucideUserRoundX } from 'lucide-react';
import { useParams } from 'react-router-dom';

import { Box, Button, Container, Text, TextArea } from '@radix-ui/themes';

import { buildGroupInviteLink } from 'helpers/url';
import { useGroupsStore } from 'store/groupsStore';

import RemoveGroupModal from 'components/Modal/RemoveGroupModal';
import MobileNavBar from 'components/Navs/MobileNavBar';
import OfflineQRCode from 'components/QRCode';

const GroupPage = () => {
    const { groups, selectedGroup, fetchSetGroupById } = useGroupsStore();

    const { groupId } = useParams<{ groupId: string }>();
    console.log(groups);
    console.log(groupId);

    useEffect(() => {
        fetchSetGroupById(groupId);
    }, [groupId, fetchSetGroupById]);

    if (!groupId) {
        return <div>No group id</div>;
    }

    const inviteLink = buildGroupInviteLink({
        inviteToken: selectedGroup?.inviteToken || '',
    });

    return (
        <Box py="6">
            <Container size="4">
                Group: {groupId}
                <Text size="4" as="p">
                    Invite link:
                </Text>
                <TextArea readOnly value={inviteLink} />
                <OfflineQRCode url={inviteLink} />
                <MobileNavBar />
                <RemoveGroupModal>
                    <Button variant="solid" color="red" size="4">
                        <LucideUserRoundX /> Remove group
                    </Button>
                </RemoveGroupModal>
            </Container>
        </Box>
    );
};

export default GroupPage;
