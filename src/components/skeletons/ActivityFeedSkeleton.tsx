import { Flex } from '@radix-ui/themes';

import { ActivityDateDividerSkeleton } from './activity-date-divider-skeleton';
import { ActivityEventSkeleton } from './activity-event-skeleton';

const SKELETON_ITEMS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

interface Props {
    isShowSummary?: boolean;
}

const ActivityFeedSkeleton = ({ isShowSummary = false }: Props) => (
    <Flex direction="column" gap="2">
        <ActivityDateDividerSkeleton isShowSummary={isShowSummary} />

        {SKELETON_ITEMS.map(item => (
            <ActivityEventSkeleton key={item} />
        ))}
    </Flex>
);

export { ActivityFeedSkeleton };
