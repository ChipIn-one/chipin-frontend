import { PROP_COLOR } from '@chipin/tokens/theme';
import { Avatar, Box, Flex, Heading, Skeleton, Text } from '@radix-ui/themes';
import { SettingsIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
                        color={PROP_COLOR.neutral}
                        fallback={<SettingsIcon size={32} />}
                    />
                </Skeleton>
                <Box>
                    <Heading size={{ initial: '5', sm: '6' }}>
                        <Skeleton loading={isLoading}>{t('title')}</Skeleton>
                    </Heading>
                    <Text size="2" color={PROP_COLOR.neutral}>
                        <Skeleton loading={isLoading}>{t('subtitle')}</Skeleton>
                    </Text>
                </Box>
            </Flex>
        </Flex>
    );
};

export default SettingsPageHeader;
