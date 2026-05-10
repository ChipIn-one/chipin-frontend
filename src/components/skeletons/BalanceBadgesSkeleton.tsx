/* eslint-disable react/jsx-no-literals */
import { Badge, Flex, Skeleton } from '@radix-ui/themes';

const SKELETON_COUNT = 3;

export const BalanceBadgesSkeleton = () => (
    <Flex gap="2" wrap="wrap">
        {Array.from({ length: SKELETON_COUNT }, (_, index) => (
            <Skeleton key={index}>
                <Badge variant="soft" size="3">
                    300 USD
                </Badge>
            </Skeleton>
        ))}
    </Flex>
);
