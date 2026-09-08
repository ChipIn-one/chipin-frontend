import { useTranslation } from 'react-i18next';

import { Box, Flex, Separator, Skeleton, Text } from '@radix-ui/themes';

interface Props {
    isShowSummary: boolean;
}

const ActivityDateDividerSkeleton = ({ isShowSummary }: Props) => {
    const { t } = useTranslation('skeletons');

    return (
        <Flex
            align="center"
            gap="3"
            py="2"
            data-activity-date-divider-skeleton
        >
            <Text size="1" color="gray" weight="medium" wrap="nowrap">
                <Skeleton>{t('activityFeed.dateDivider')}</Skeleton>
            </Text>

            <Box flexGrow="1">
                <Separator size="4" />
            </Box>

            {isShowSummary ? (
                <Text
                    size="1"
                    color="gray"
                    weight="medium"
                    wrap="nowrap"
                    data-activity-date-divider-summary-skeleton
                >
                    <Skeleton>{t('activityFeed.dateDividerSummary')}</Skeleton>
                </Text>
            ) : null}
        </Flex>
    );
};

export { ActivityDateDividerSkeleton };
