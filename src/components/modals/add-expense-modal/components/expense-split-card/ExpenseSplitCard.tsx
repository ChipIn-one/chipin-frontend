import { useTranslation } from 'react-i18next';

import { Card, Flex, Text } from '@radix-ui/themes';

import { selectShouldShowOtherDirectZeroDebtWarning } from 'store/expenseModalSelectors';
import { useExpenseModalStore } from 'store/expenseModalStore';

import {
    ExpenseSplitModeControl,
    ExpenseUsersList,
    SplitTypeHeader,
} from './components';

const ExpenseSplitCard = () => {
    const { t } = useTranslation('group');
    const showWarning = useExpenseModalStore(selectShouldShowOtherDirectZeroDebtWarning);

    return (
        <Card>
            <Flex direction="column" gap="4">
                <ExpenseSplitModeControl />
                <SplitTypeHeader />
                <ExpenseUsersList />
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
