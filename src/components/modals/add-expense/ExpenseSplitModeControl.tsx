import { Amount } from 'basics';
import styled from 'styled-components';

import { Flex, Text } from '@radix-ui/themes';

import { themeColor } from 'helpers/colors';

import SegmentedControl, { SegmentedControlItem } from 'components/SegmentedControl';

const SUMMARY_SEPARATOR = ' / ';
const PROGRESS_MAX = 100;

const FullWidthSegmentedControl = styled(SegmentedControl)<{ $itemCount: number }>`
    display: grid;
    grid-template-columns: repeat(${({ $itemCount }) => $itemCount}, minmax(0, 1fr));
    width: 100%;

    & > * {
        justify-content: center;
        min-width: 0;
    }
`;

const ProgressBar = styled.div`
    height: 4px;
    width: 100%;
    background-color: ${themeColor('gray4')};
    border-radius: var(--radius-full);
    overflow: hidden;
`;

export type SplitStatus = 'exact' | 'under' | 'over';

const ProgressFill = styled.div<{ $percent: number; $status: SplitStatus }>`
    height: 100%;
    width: ${({ $percent }) => Math.min(Math.max($percent, 0), PROGRESS_MAX)}%;
    background-color: ${({ $status }) =>
        $status === 'exact'
            ? themeColor('jade9')
            : $status === 'under'
              ? themeColor('red9')
              : themeColor('amber9')};
    transition:
        width 150ms ease,
        background-color 150ms ease;
`;

interface Props {
    title: string;
    totalLabel: string;
    assignedAmount: number;
    totalAmount: number;
    currency: string;
    status?: SplitStatus;
    progressPercent?: number;
    value: string;
    items: SegmentedControlItem[];
    onValueChange: (value: string) => void;
}

const ExpenseSplitModeControl = ({
    title,
    totalLabel,
    assignedAmount,
    totalAmount,
    currency,
    status = 'exact',
    progressPercent = 0,
    value,
    items,
    onValueChange,
}: Props) => {
    const statusColor = status === 'exact' ? 'jade' : status === 'under' ? 'red' : 'amber';

    return (
        <Flex direction="column" gap="2" width="100%">
            <Flex justify="between" align="center" gap="3">
                <Text size="2" weight="bold" color="gray">
                    {title}
                </Text>
                <Flex align="center" gap="1">
                    <Text size="2" color="gray">
                        {totalLabel}
                    </Text>
                    <Text size="2" weight="bold" color={statusColor}>
                        <Amount value={assignedAmount} tokenCode={currency} />
                    </Text>
                    <Text size="2" color="gray">
                        {SUMMARY_SEPARATOR}
                    </Text>
                    <Text size="2" weight="bold" color="gray">
                        <Amount value={totalAmount} tokenCode={currency} />
                    </Text>
                </Flex>
            </Flex>
            <FullWidthSegmentedControl
                $itemCount={items.length}
                value={value}
                onValueChange={onValueChange}
                items={items}
            />
            <ProgressBar>
                <ProgressFill $percent={progressPercent} $status={status} />
            </ProgressBar>
        </Flex>
    );
};

export default ExpenseSplitModeControl;
