import { ComponentProps } from 'react';
import Big from 'bignumber.js';

import { Badge, Flex } from '@radix-ui/themes';

import { BalanceBadgesSkeleton } from 'components/skeletons';

import { Amount } from './numbers';

export interface BadgeItem {
    tokenCode: string;
    value: Big | null;
    color: ComponentProps<typeof Badge>['color'];
}

const DEFAULT_MAX_VISIBLE = 3;

interface Props {
    items: BadgeItem[];
    isLoading?: boolean;
    maxVisible?: number;
    overflowColor?: ComponentProps<typeof Badge>['color'];
}

const BalanceBadges: React.FC<Props> = ({
    items,
    isLoading = false,
    maxVisible = DEFAULT_MAX_VISIBLE,
    overflowColor = 'gray',
}) => {
    if (!isLoading && items.length <= 1) {
        return null;
    }

    if (isLoading) {
        return <BalanceBadgesSkeleton />;
    }

    const visibleItems = items.slice(0, maxVisible);
    const hiddenCount = items.length - visibleItems.length;

    return (
        <Flex gap="2" wrap="wrap">
            {visibleItems.map(item => (
                <Badge
                    key={item.tokenCode}
                    color={item.color}
                    variant="soft"
                    size={{ initial: '2', sm: '3' }}
                >
                    <Amount value={item.value} tokenCode={item.tokenCode} precision={0} />
                </Badge>
            ))}

            {hiddenCount > 0 && (
                <Badge color={overflowColor} variant="soft" size={{ initial: '2', sm: '3' }}>
                    +{hiddenCount}
                </Badge>
            )}
        </Flex>
    );
};

export default BalanceBadges;
