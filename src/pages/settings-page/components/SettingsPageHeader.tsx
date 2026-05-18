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
                    <Skeleton loading={isLoading}>
                        <Heading size={{ initial: '5', sm: '6' }}>{t('title')}</Heading>
                    </Skeleton>
                    <Skeleton loading={isLoading}>
                        <Text size="2" color="gray">
                            {t('subtitle')}
                        </Text>
                    </Skeleton>
                </Box>
            </Flex>
        </Flex>
    );
};

export default SettingsPageHeader;
