import { useState } from 'react';
import { Button, Flex } from '@radix-ui/themes';
import { LogOutIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useSelfUserState } from 'hooks/useSelfUser';

import { useSignOutConfirm } from 'components/sign-out-confirm';
import { UserProfileSummary } from 'components/user-profile-summary';

import { ProfileButton, ProfileChevron, ProfileSignOutContent, ProfileSignOutSlot } from './styled';

interface Props {
    isSoloMode: boolean;
}

const ProfileActions = ({ isSoloMode }: Props) => {
    const { t } = useTranslation('common');
    const [isExpanded, setIsExpanded] = useState(false);
    const { requestSignOut, dialog: signOutDialog } = useSignOutConfirm();
    const { user, isLoading: isUserLoading } = useSelfUserState();
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
                        onClick={requestSignOut}
                        disabled={!isExpanded}
                        tabIndex={isExpanded ? 0 : -1}
                        variant="soft"
                        color="gray"
                        size="3"
                    >
                        <LogOutIcon size={18} />
                        {t('buttons.signOut')}
                    </Button>
                </ProfileSignOutContent>
            </ProfileSignOutSlot>
            {signOutDialog}
        </Flex>
    );
};

export default ProfileActions;
