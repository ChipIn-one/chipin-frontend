import { LucidePencil, LucideTrash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Box, Button, Flex, Separator, Skeleton, Text } from '@radix-ui/themes';

import {
    ActivityExpenseEventSkeleton,
    ActivitySettlementEventSkeleton,
} from './ActivityEventSkeleton';

const CHILD_EVENT_SKELETON_COUNT = 3;

export const ActivityChildrenEventsSkeleton = () => {
    const { t } = useTranslation('skeletons');

    return (
        <Flex direction="column" gap="2">
            <Flex align="center" gap="3" py="2">
                <Text size="1" color="gray" weight="medium" wrap="nowrap">
                    <Skeleton>{t('activityFeed.relativeTime')}</Skeleton>
                </Text>

                <Box flexGrow="1">
                    <Separator size="4" />
                </Box>
            </Flex>

            {Array.from({ length: CHILD_EVENT_SKELETON_COUNT }, (_, index) =>
                index % 2 === 0 ? (
                    <ActivityExpenseEventSkeleton key={index} />
                ) : (
                    <ActivitySettlementEventSkeleton key={index} />
                ),
            )}
        </Flex>
    );
};

export const ActivityChildrenPageSkeleton = () => {
    const { t } = useTranslation('activity');

    return (
        <Flex direction="column" gap="2">
            <Box mb="2">
                <Flex
                    justify="between"
                    align={{ initial: 'start', sm: 'center' }}
                    gap="3"
                    mb="2"
                    direction={{ initial: 'column', sm: 'row' }}
                >
                    <Text size="2" color="gray" weight="medium">
                        <Skeleton>{t('childExpenseHistoryTitle')}</Skeleton>
                    </Text>

                    <Flex align="center" gap="2" wrap="wrap">
                        <Skeleton>
                            <Button size="1" variant="soft" disabled>
                                <LucidePencil size={14} />
                                {t('childUpdateAction')}
                            </Button>
                        </Skeleton>

                        <Skeleton>
                            <Button size="1" variant="soft" color="red" disabled>
                                <LucideTrash2 size={14} />
                                {t('childDeleteAction')}
                            </Button>
                        </Skeleton>
                    </Flex>
                </Flex>

                <ActivityExpenseEventSkeleton />
            </Box>

            <ActivityChildrenEventsSkeleton />
        </Flex>
    );
};
