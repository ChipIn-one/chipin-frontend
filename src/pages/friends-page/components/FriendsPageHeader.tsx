import { LucideUserPlus, LucideUsers } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Avatar, Box, Button, Flex, Heading, Skeleton, Text } from '@radix-ui/themes';

interface Props {
    isLoading: boolean;
}

const FriendsPageHeader = ({ isLoading }: Props) => {
    const { t } = useTranslation(['friends', 'common']);

    return (
        <Flex justify="between" align="center">
            <Flex align="center" gap="4">
                <Skeleton loading={isLoading}>
                    <Avatar size="5" color="cyan" fallback={<LucideUsers size={32} />} />
                </Skeleton>
                <Box>
                    <Skeleton loading={isLoading}>
                        <Heading size="6">{t('friends:title')}</Heading>
                    </Skeleton>
                    <Skeleton loading={isLoading}>
                        <Text size="2" color="gray">
                            {t('friends:subtitle')}
                        </Text>
                    </Skeleton>
                </Box>
            </Flex>
            <Button variant="soft" loading={isLoading}>
                <LucideUserPlus size={16} />
                {t('common:buttons.addFriend')}
            </Button>
        </Flex>
    );
};

export default FriendsPageHeader;
