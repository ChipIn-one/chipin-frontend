import { LucideArrowRight, LucideChartBar } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Avatar, Box, Button, Flex, Skeleton, Text } from '@radix-ui/themes';

import { ROUTES } from 'constants/routes';

export type ActivityHeaderContext = 'dashboard' | 'group' | 'full';

interface ActivityHeaderProps {
    isLoading: boolean;
    context: ActivityHeaderContext;
}

const subtitleKeyByContext: Record<ActivityHeaderContext, string> = {
    dashboard: 'subtitleDashboard',
    group: 'subtitleGroup',
    full: 'subtitleFull',
};

const ActivityHeader = ({ isLoading, context }: ActivityHeaderProps) => {
    const showViewAllButton = context !== 'full';
    const { t } = useTranslation('activity');

    return (
        <Box mb="4">
            <Flex justify="between" align="center">
                <Flex align="center" gap="4">
                    <Skeleton loading={isLoading}>
                        <Avatar size="5" color="cyan" fallback={<LucideChartBar size={32} />} />
                    </Skeleton>

                    <Flex direction="column">
                        <Skeleton loading={isLoading}>
                            <Text size="4" weight="medium" as="p" mb="1">
                                {t('title')}
                            </Text>
                        </Skeleton>

                        <Skeleton loading={isLoading}>
                            <Text size="2" as="p" color="gray">
                                {t(subtitleKeyByContext[context])}
                            </Text>
                        </Skeleton>
                    </Flex>
                </Flex>

                {showViewAllButton ? (
                    <Link to={ROUTES.ACTIVITY}>
                        <Button variant="soft" size="3" loading={isLoading}>
                            {t('common:buttons.viewAllActivity')}
                            <LucideArrowRight size={20} />
                        </Button>
                    </Link>
                ) : null}
            </Flex>
        </Box>
    );
};

export default ActivityHeader;
