import { useEffect } from 'react';
import { useParams } from 'react-router-dom';

import { Box, Container, Text, TextArea } from '@radix-ui/themes';

import { buildGroupInviteLink } from 'helpers/url';
import { useGroupsStore } from 'store/groupsStore';

import MobileNavBar from 'components/Navs/MobileNavBar';
import QRCode from 'components/QRCode';

const GroupPage = () => {
    const { groups, selectedGroup, fetchSetUserGroupById } = useGroupsStore();

    const { groupId } = useParams<{ groupId: string }>();
    console.log(groups);
    console.log(groupId);

    useEffect(() => {
        fetchSetUserGroupById(groupId);
    }, [groupId, fetchSetUserGroupById]);

    if (!selectedGroup) {
        return <div>No selected group</div>;
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
                <QRCode url={inviteLink} />
                <MobileNavBar />
            </Container>
        </Box>
    );
};

export default GroupPage;
