import { LucideSettings } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Avatar, Box, Flex, Heading, Skeleton, Text } from '@radix-ui/themes';

interface Props {
    isLoading: boolean;
}

const SettingsPageHeader = ({ isLoading }: Props) => {
    const { t } = useTranslation('settings');

    return (
        <Flex justify="between" align="center" mb="4">
            <Flex align="center" gap={{ initial: '3', sm: '4' }}>
                <Skeleton loading={isLoading}>
                    <Avatar
                        size={{ initial: '4', sm: '5' }}
                        color="cyan"
                        fallback={<LucideSettings size={32} />}
                    />
                </Skeleton>
                <Box>
                    <Heading size={{ initial: '5', sm: '6' }}>
                        <Skeleton loading={isLoading}>{t('title')}</Skeleton>
                    </Heading>
                    <Text size="2" color="gray">
                        <Skeleton loading={isLoading}>
                            {t('subtitle')}
                        </Skeleton>
                    </Text>
                </Box>
            </Flex>
        </Flex>
    );
};

export default SettingsPageHeader;
