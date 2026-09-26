import { useMemo } from 'react';
import { Amount } from 'basics';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import { Flex, Text } from '@radix-ui/themes';

import { type ExpenseSplitMode } from 'constants/chipin';
import { selectSplitSummary } from 'store/expenseModalSelectors';
import { useExpenseModalStore } from 'store/expenseModalStore';

import { ProgressBar } from 'components/progress-bar';
import SegmentedControl from 'components/SegmentedControl';

import { EXPENSE_SPLIT_MODE_ITEMS, SPLIT_SUMMARY_SEPARATOR } from './constants';
import { getStatusColor } from './helpers';

const ExpenseSplitModeControl = () => {
    const { t } = useTranslation('group');
    const {
        assignedAmount,
        totalAmount,
        status,
        progressPercent,
        currency,
        splitMode,
        setSplitMode,
    } = useExpenseModalStore(
        useShallow(state => {
            const summary = selectSplitSummary(state);

            return {
                ...summary,
                currency: state.currency,
                splitMode: state.splitMode,
                setSplitMode: state.setSplitMode,
            };
        }),
    );

    const statusColor = getStatusColor(status);

    const items = useMemo(
        () =>
            EXPENSE_SPLIT_MODE_ITEMS.map(({ value, labelKey }) => ({
                value,
                label: t(labelKey),
            })),
        [t],
    );

    return (
        <Flex direction="column" gap="2" width="100%">
            <Flex justify="between" align="center" gap="3">
                <Text size="2" weight="bold" color="gray">
                    {t('expenses.modal.split.title')}
                </Text>
                <Flex align="center" gap="1">
                    <Text size="2" color="gray">
                        {t('expenses.modal.split.total')}
                    </Text>
                    <Text size="2" weight="bold" color={statusColor}>
                        <Amount value={assignedAmount} tokenCode={currency} />
                    </Text>
                    <Text size="2" color="gray">
                        {SPLIT_SUMMARY_SEPARATOR}
                    </Text>
                    <Text size="2" weight="bold" color="gray">
                        <Amount value={totalAmount} tokenCode={currency} />
                    </Text>
                </Flex>
            </Flex>
            <SegmentedControl
                value={splitMode}
                onValueChange={value => setSplitMode(value as ExpenseSplitMode)}
                items={items}
            />
            <ProgressBar value={progressPercent} color={statusColor} />
        </Flex>
    );
};

export default ExpenseSplitModeControl;
