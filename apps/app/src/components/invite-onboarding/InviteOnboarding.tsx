import { PROP_COLOR } from '@chipin/tokens/theme';
import { Button, Card, Flex, Heading, Text } from '@radix-ui/themes';
import { UserPlusIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { UseInviteResult } from 'hooks/pwaHooks';

import { InviteActionRows } from 'components/invite';

import InviteIllustrationAsset from 'assets/group-invite-empty-state.webp';

import styles from './InviteOnboarding.module.css';

interface Props {
    invite: UseInviteResult;
}

const InviteOnboarding = ({ invite }: Props) => {
    const { t } = useTranslation('group');

    const onInviteFriends = (): Promise<void> => {
        if (invite.isNativeShareSupported) {
            return invite.onShare();
        }

        return invite.onCopyLink();
    };

    return (
        <Flex direction="column" gap="3">
            <Card className={styles.root} size="3">
                <Flex direction="column" align="center" gap="3">
                    <img
                        className={styles.illustration}
                        src={InviteIllustrationAsset}
                        alt=""
                        aria-hidden="true"
                        decoding="async"
                    />

                    <Flex direction="column" align="center" gap="1">
                        <Heading as="h3" size="5" align="center">
                            {t('page.expenses.inviteTitle')}
                        </Heading>
                        <Text size="2" color={PROP_COLOR.neutral} align="center">
                            {t('page.expenses.inviteDescription')}
                        </Text>
                    </Flex>

                    <Button
                        className={styles.inviteButton}
                        type="button"
                        size="3"
                        color={PROP_COLOR.accent}
                        radius="full"
                        onClick={() => void onInviteFriends()}
                    >
                        <UserPlusIcon size={18} />
                        {t('page.expenses.inviteAction')}
                    </Button>
                </Flex>
            </Card>

            <Flex className={styles.shareDivider} width="100%" align="center" gap="3">
                <Text size="1" color={PROP_COLOR.neutral}>
                    {t('page.expenses.shareVia')}
                </Text>
            </Flex>

            <InviteActionRows invite={invite} />
        </Flex>
    );
};

export { InviteOnboarding };
