import { Amount } from 'basics';
import { LucideCheck, LucideX } from 'lucide-react';

import { Button, Flex, Text } from '@radix-ui/themes';

interface Props {
    selectAllLabel: string;
    deselectAllLabel: string;
    isAllSelected: boolean;
    isToggleHidden?: boolean;
    yourShareLabel: string;
    yourShareAmount: number;
    currency: string;
    onToggleAll: () => void;
}

const SplitParticipantsActions = ({
    selectAllLabel,
    deselectAllLabel,
    isAllSelected,
    isToggleHidden = false,
    yourShareLabel,
    yourShareAmount,
    currency,
    onToggleAll,
}: Props) => {
    const label = isAllSelected ? deselectAllLabel : selectAllLabel;
    const Icon = isAllSelected ? LucideX : LucideCheck;

    return (
        <Flex justify="between" align="center" gap="3">
            {isToggleHidden ? (
                <span />
            ) : (
                <Button type="button" size="1" variant="soft" color="gray" onClick={onToggleAll}>
                    <Icon size={14} />
                    {label}
                </Button>
            )}
            <Flex align="center" gap="1">
                <Text size="2" color="gray">
                    {yourShareLabel}
                </Text>
                <Text size="2" weight="bold">
                    <Amount value={yourShareAmount} tokenCode={currency} />
                </Text>
            </Flex>
        </Flex>
    );
};

export default SplitParticipantsActions;
