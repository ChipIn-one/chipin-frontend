import { useState } from 'react';
import { PROP_COLOR } from '@chipin/tokens/theme';
import { Button, Flex } from '@radix-ui/themes';
import { ChevronDownIcon, LogOutIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useSelfUserState } from 'hooks/useSelfUser';

import { useSignOutConfirm } from 'components/sign-out-confirm';
import { UserProfileSummary } from 'components/user-profile-summary';

import styles from './ProfileActions.module.css';

interface Props {
    isSoloMode: boolean;
}

const ProfileActions = ({ isSoloMode }: Props) => {
    const { t } = useTranslation('common');
    const [isExpanded, setIsExpanded] = useState(false);
    const { requestSignOut, dialog: signOutDialog } = useSignOutConfirm();
    const { user, isLoading: isUserLoading } = useSelfUserState();
    const activeColor = isSoloMode ? PROP_COLOR.solo : PROP_COLOR.accent;

    const onToggle = () => {
        setIsExpanded(expanded => !expanded);
    };

    return (
        <Flex className={styles.root} data-expanded={isExpanded} direction="column">
            <Button
                className={styles.profileButton}
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
                <ChevronDownIcon className={styles.chevron} size={20} aria-hidden />
            </Button>

            <div
                className={styles.signOutSlot}
                id="desktop-profile-actions"
                aria-hidden={!isExpanded}
            >
                <div className={styles.signOutContent}>
                    <Button
                        onClick={requestSignOut}
                        disabled={!isExpanded}
                        tabIndex={isExpanded ? 0 : -1}
                        variant="soft"
                        color={PROP_COLOR.neutral}
                        size="3"
                    >
                        <LogOutIcon size={18} />
                        {t('buttons.signOut')}
                    </Button>
                </div>
            </div>
            {signOutDialog}
        </Flex>
    );
};

export { ProfileActions };
