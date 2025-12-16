import { useParams } from 'react-router-dom';

import { Box, Container, Text, TextArea } from '@radix-ui/themes';

import { buildGroupInviteLink } from 'helpers/url';
import { useGroupStore } from 'store/groupStore';

import BottomNavMobile from 'components/BottomNavMobile';
import Breadcrumbs from 'components/Breadcrumbs';

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
        <Box py="4">
            <Container size="4">
                <Breadcrumbs />
                Group: {groupId}
                <Text size="4" as="p">
                    Invite link:
                </Text>
                <TextArea readOnly value={inviteLink} />
                <BottomNavMobile />
            </Container>
        </Box>
    );
};

export default GroupPage;
