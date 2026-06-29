import { useState } from 'react';
import { UserAvatar } from 'basics';
import { LucideUser } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';

import {
    Avatar,
    Box,
    Card,
    Flex,
    Link,
    Separator,
    Skeleton,
    Text,
    TextField,
} from '@radix-ui/themes';

import { useUsersStore } from 'store/usersStore';

interface Props {
    isLoading: boolean;
}

const AccountSection = ({ isLoading }: Props) => {
    const { t } = useTranslation('settings');
    const { t: tSkeletons } = useTranslation('skeletons');
    const user = useUsersStore(s => s.user);
    const setUserSettings = useUsersStore(s => s.setUserSettings);
    const [displayName, setDisplayName] = useState(user?.displayName ?? '');

    const onChangeDisplayName = (event: ChangeEvent<HTMLInputElement>) => {
        setDisplayName(event.target.value);
    };

    const onBlurDisplayName = () => {
        setUserSettings({ displayName });
    };

    return (
        <Card size="3">
            <Flex direction="column" gap="4">
                <Flex align="center" gap="3">
                    <Skeleton loading={isLoading}>
                        <Avatar
                            variant="soft"
                            size="3"
                            color="mint"
                            fallback={<LucideUser size={20} />}
                        />
                    </Skeleton>
                    <Box>
                        <Text weight="medium">
                            <Skeleton loading={isLoading}>{t('account.title')}</Skeleton>
                        </Text>
                        <Text size="2" color="gray">
                            <Skeleton loading={isLoading}>
                                {t('account.description')}
                            </Skeleton>
                        </Text>
                    </Box>
                </Flex>

                <Separator size="4" />

                <Flex align="center" gap="3">
                    <UserAvatar size="4" user={user ?? undefined} isLoading={isLoading} />

                    <Flex direction="column" gap="1">
                        <Text weight="medium" size="3">
                            <Skeleton loading={isLoading}>
                                {isLoading
                                    ? tSkeletons('account.displayName')
                                    : user?.displayName || t('common:fields.displayName')}
                            </Skeleton>
                        </Text>
                        <Text size="2" color="gray">
                            <Skeleton loading={isLoading}>
                                {isLoading ? tSkeletons('account.email') : user?.email}
                            </Skeleton>
                        </Text>
                        <Skeleton loading={isLoading}>
                            <Link size="2" color="green" href="#">
                                {t('common:buttons.changePhoto')}
                            </Link>
                        </Skeleton>
                    </Flex>
                </Flex>

                <Separator size="4" />

                <Box>
                    <Text size="2" color="gray">
                        <Skeleton loading={isLoading}>
                            {t('common:fields.displayName')}
                        </Skeleton>
                    </Text>
                    <Skeleton loading={isLoading}>
                        <TextField.Root
                            mt="2"
                            size="3"
                            value={displayName}
                            placeholder={t('account.displayNamePlaceholder')}
                            onChange={onChangeDisplayName}
                            onBlur={onBlurDisplayName}
                        />
                    </Skeleton>
                </Box>
            </Flex>
        </Card>
    );
};

export default AccountSection;
