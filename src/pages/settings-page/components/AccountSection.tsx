import { UserAvatar } from 'basics';
import { LucideUser } from 'lucide-react';
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
    const { user } = useUsersStore();

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
                        <Skeleton loading={isLoading}>
                            <Text weight="medium">{t('account.title')}</Text>
                        </Skeleton>
                        <Skeleton loading={isLoading}>
                            <Text size="2" color="gray" as="p">
                                {t('account.description')}
                            </Text>
                        </Skeleton>
                    </Box>
                </Flex>

                <Separator size="4" />

                <Flex align="center" gap="3">
                    <UserAvatar size="4" isLoading={isLoading} />

                    <Flex direction="column" gap="1">
                        <Skeleton loading={isLoading}>
                            <Text weight="medium" size="3">
                                {user?.displayName || 'Display Name'}
                            </Text>
                        </Skeleton>
                        <Skeleton loading={isLoading}>
                            <Text size="2" color="gray">
                                {user?.email || 'email@example.com'}
                            </Text>
                        </Skeleton>
                        <Skeleton loading={isLoading}>
                            <Link size="2" color="green" href="#">
                                {t('common:buttons.changePhoto')}
                            </Link>
                        </Skeleton>
                    </Flex>
                </Flex>

                <Separator size="4" />

                <Box>
                    <Skeleton loading={isLoading}>
                        <Text size="2" color="gray">
                            {t('common:fields.displayName')}
                        </Text>
                    </Skeleton>
                    <Skeleton loading={isLoading}>
                        <TextField.Root
                            mt="2"
                            size="3"
                            value={user?.displayName || ''}
                            placeholder={t('account.displayNamePlaceholder')}
                            readOnly
                        />
                    </Skeleton>
                </Box>
            </Flex>
        </Card>
    );
};

export default AccountSection;
