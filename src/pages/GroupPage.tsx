import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import { Box, Container, Text, TextArea } from '@radix-ui/themes';

import { buildGroupInviteLink } from 'helpers/url';
import { useGroupStore } from 'store/groupStore';

import BottomNavMobile from 'components/BottomNavMobile';
import Breadcrumbs from 'components/Breadcrumbs';

const BalancesPage = () => {
    const { selectedGroup, inviteToGroup } = useGroupStore();

    // const navigate = useNavigate();
    const { groupId } = useParams<{ groupId: string }>();
    const [searchParams] = useSearchParams();

    const inviteToken = searchParams.get('inviteToken');

    useEffect(() => {
        if (!groupId) {
            return;
        }

        if (inviteToken) {
            inviteToGroup({ inviteToken });
            // navigate(`/groups/${groupId}`, { replace: true });
        }
    }, [groupId, inviteToken]);

    const inviteLink = buildGroupInviteLink({
        groupId: selectedGroup?.id || '',
        inviteToken: selectedGroup?.inviteToken || '',
    });

    return (
        <Box py="4">
            <Container size="4">
                <Breadcrumbs />
                Group: {groupId}
                <Text size="4">Invite link:</Text>
                <TextArea readOnly value={inviteLink} />
                <BottomNavMobile />
            </Container>
        </Box>
    );
};

export default BalancesPage;
