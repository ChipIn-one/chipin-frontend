import { useParams } from 'react-router-dom';

import { Box, Container, Text, TextArea } from '@radix-ui/themes';

import { buildGroupInviteLink } from 'helpers/url';
import { useGroupStore } from 'store/groupStore';

const GroupPage = () => {
    const { selectedGroup } = useGroupStore();

    const { groupId } = useParams<{ groupId: string }>();

    if (!selectedGroup) {
        return <div>No selected group</div>;
    }

    const inviteLink = buildGroupInviteLink({
        inviteToken: selectedGroup.inviteToken,
    });

    return (
        <Box py="6">
            <Container size="4">
                Group: {groupId}
                <Text size="4" as="p">
                    Invite link:
                </Text>
                <TextArea readOnly value={inviteLink} />
            </Container>
        </Box>
    );
};

export default GroupPage;
