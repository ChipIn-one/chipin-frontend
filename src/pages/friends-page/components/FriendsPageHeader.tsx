import { LucideUserPlus, LucideUsers } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Avatar, Box, Button, Flex, Heading, Skeleton, Text } from '@radix-ui/themes';

interface Props {
    isLoading: boolean;
}

const FriendsPageHeader = ({ isLoading }: Props) => {
    const { t } = useTranslation(['friends', 'common']);

    return (
        <Flex
            justify="between"
            align={{ initial: 'center', lg: 'stretch' }}
            direction={{ initial: 'row', lg: 'column' }}
            gap={{ lg: '3' }}
        >
            <Flex align="center" gap={{ initial: '3', sm: '4' }}>
                <Skeleton loading={isLoading}>
                    <Avatar
                        size={{ initial: '4', sm: '5' }}
                        color="cyan"
                        fallback={<LucideUsers size={32} />}
                    />
                </Skeleton>
                <Box>
                    <Heading size={{ initial: '5', sm: '6' }}>
                        <Skeleton loading={isLoading}>{t('friends:title')}</Skeleton>
                    </Heading>
                    <Text size="2" color="gray">
                        <Skeleton loading={isLoading}>
                            {t('friends:yourConnections')}
                        </Skeleton>
                    </Text>
                </Box>
            </Flex>
            <Button variant="soft" loading={isLoading}>
                <LucideUserPlus size={16} />
                <Box display={{ initial: 'none', sm: 'inline' }}>
                    <Text as="span">{t('common:buttons.addFriend')}</Text>
                </Box>
            </Button>
        </Flex>
    );
};

export default FriendsPageHeader;
