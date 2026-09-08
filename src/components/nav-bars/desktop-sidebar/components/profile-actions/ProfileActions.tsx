import { useState } from 'react';
import { LucideLogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button, Flex } from '@radix-ui/themes';

import { useAuthStore } from 'store/authStore';
import { selectAuthSignOutLoading, selectUserSelfLoading } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';
import { useUsersStore } from 'store/users-store';

import { UserProfileSummary } from 'components/user-profile-summary';

import { ProfileButton, ProfileChevron, ProfileSignOutContent, ProfileSignOutSlot } from './styled';

interface Props {
    isSoloMode: boolean;
}

const ProfileActions = ({ isSoloMode }: Props) => {
    const { t } = useTranslation('common');
    const [isExpanded, setIsExpanded] = useState(false);
    const isUserLoading = useLoadingStore(selectUserSelfLoading);
    const isSigningOut = useLoadingStore(selectAuthSignOutLoading);
    const signOut = useAuthStore(state => state.signOut);
    const user = useUsersStore(state => state.user);
    const activeColor = isSoloMode ? 'violet' : 'green';

    const onToggle = () => {
        setIsExpanded(expanded => !expanded);
    };

    return (
        <Flex direction="column">
            <ProfileButton
                onClick={onToggle}
                aria-expanded={isExpanded}
                aria-controls="desktop-profile-actions"
                variant="soft"
                color={activeColor}
                radius="large"
            >
                <UserProfileSummary
                    user={user ?? undefined}
                    isLoading={isUserLoading}
                    avatarSize="4"
                />
                <ProfileChevron $isExpanded={isExpanded} size={20} aria-hidden />
            </ProfileButton>

            <ProfileSignOutSlot
                id="desktop-profile-actions"
                $isExpanded={isExpanded}
                aria-hidden={!isExpanded}
            >
                <ProfileSignOutContent>
                    <Button
                        onClick={signOut}
                        disabled={!isExpanded || isSigningOut}
                        tabIndex={isExpanded ? 0 : -1}
                        loading={isSigningOut}
                        variant="soft"
                        color="gray"
                        size="3"
                    >
                        <LucideLogOut size={18} />
                        {t('buttons.signOut')}
                    </Button>
                </ProfileSignOutContent>
            </ProfileSignOutSlot>
        </Flex>
    );
};

export default ProfileActions;
