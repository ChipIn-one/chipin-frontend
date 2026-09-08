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
        <Box>
            <Flex justify="between" align="center">
                <Flex align="center" gap="4">
                    <Skeleton loading={isLoading}>
                        <Avatar
                            size={{ initial: '4', sm: '5' }}
                            color="cyan"
                            fallback={<LucideChartBar size={32} />}
                        />
                    </Skeleton>

                    <Flex direction="column">
                        <Text size="4" weight="medium" mb="1">
                            <Skeleton loading={isLoading}>{t('title')}</Skeleton>
                        </Text>

                        <Text size="2" color="gray">
                            <Skeleton loading={isLoading}>{t('subtitle')}</Skeleton>
                        </Text>
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
                    />
                </Skeleton>
            </Box>
        </Box>
    );
};

export default ActivityHeader;
