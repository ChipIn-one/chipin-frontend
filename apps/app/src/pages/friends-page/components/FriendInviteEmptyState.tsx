import { useTranslation } from 'react-i18next';

import { useFriendInvite } from 'hooks/pwaHooks';
import { useSelfUserState } from 'hooks/useSelfUser';

import { LoadErrorEmptyState } from 'basics/empty-states';
import { InviteOnboarding } from 'components/invite-onboarding';
import { FriendsPageSkeleton } from 'components/skeletons';

const FriendInviteEmptyState = () => {
    const { t } = useTranslation('friends');
    const { user, isLoading, refetch } = useSelfUserState();
    const inviteToken = user?.inviteToken;
    const invite = useFriendInvite(inviteToken ?? '');

    if (isLoading) {
        return <FriendsPageSkeleton />;
    }

    // USR-013: no invite token to share means the self user did not load: an error whose Retry
    // reloads the self user, never an empty area.
    if (!inviteToken) {
        return (
            <LoadErrorEmptyState
                title={t('inviteLoadErrorTitle')}
                description={t('inviteLoadErrorDescription')}
                onRetry={() => void refetch()}
            />
        );
    }

    return <InviteOnboarding invite={invite} />;
};

export { FriendInviteEmptyState };
