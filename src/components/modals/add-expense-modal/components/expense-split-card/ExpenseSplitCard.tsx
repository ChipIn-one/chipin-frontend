import { LucideAlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Callout, Card, Flex, Text } from '@radix-ui/themes';

import {
    selectShouldShowOtherDirectZeroDebtWarning,
    selectShouldShowSelfOnlyCallout,
} from 'store/expenseModalSelectors';
import { useExpenseModalStore } from 'store/expenseModalStore';

import {
    ExpenseSplitModeControl,
    ExpenseUsersList,
    SplitTypeHeader,
} from './components';

const ExpenseSplitCard = () => {
    const { t } = useTranslation('group');
    const showWarning = useExpenseModalStore(selectShouldShowOtherDirectZeroDebtWarning);
    const showSkippedPayerCallout = useExpenseModalStore(state =>
        state.mode === 'create' &&
        state.source.skipCategory &&
        selectShouldShowSelfOnlyCallout(state),
    );

    return (
        <Card>
            <Flex direction="column" gap="4">
                <ExpenseSplitModeControl />
                <SplitTypeHeader />
                <ExpenseUsersList />
                {showSkippedPayerCallout && (
                    <Callout.Root color="amber" size="2" role="alert">
                        <Callout.Icon>
                            <LucideAlertTriangle size={18} />
                        </Callout.Icon>
                        <Callout.Text>
                            {t('expenses.modal.directSelfOnlyWarning')}
                        </Callout.Text>
                    </Callout.Root>
                )}
                {showWarning && (
                    <Text as="p" size="2" color="red" role="alert">
                        {t('expenses.modal.directZeroDebtWarning')}
                    </Text>
                )}
            </Flex>
        </Card>
    );
};

export default ExpenseSplitCard;
