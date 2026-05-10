import { LucideChartBar, LucideSlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Avatar, Box, Flex, IconButton, Skeleton, Text } from '@radix-ui/themes';

import SegmentedControl from 'components/SegmentedControl';

export type ActivityFilter = 'all' | 'expenses' | 'settlements';

interface Props {
    isLoading: boolean;
    activeFilter: ActivityFilter;
    onFilterChange: (filter: ActivityFilter) => void;
}

const ActivityHeader = ({ isLoading, activeFilter, onFilterChange }: Props) => {
    const { t } = useTranslation('activity');

    const filterItems = [
        { value: 'all', label: t('filterAll') },
        { value: 'expenses', label: t('filterExpenses') },
        { value: 'settlements', label: t('filterSettlements') },
    ];

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
                                {t('subtitle')}
                            </Text>
                        </Skeleton>
                    </Flex>
                </Flex>

                <IconButton variant="ghost" disabled>
                    <LucideSlidersHorizontal size={20} />
                </IconButton>
            </Flex>

            <Box mt="3">
                <Skeleton loading={isLoading}>
                    <SegmentedControl
                        items={filterItems}
                        value={activeFilter}
                        onValueChange={value => onFilterChange(value as ActivityFilter)}
                        size="3"
                    />
                </Skeleton>
            </Box>
        </Box>
    );
};

export default ActivityHeader;
