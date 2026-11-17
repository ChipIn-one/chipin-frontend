import { Card, Flex } from '@radix-ui/themes';

import ExpenseSplitModeControl from './components/expense-split-mode-control/ExpenseSplitModeControl';
import ExpenseUsersList from './components/expense-users-list/ExpenseUsersList';
import SplitTypeHeader from './components/split-type-header/SplitTypeHeader';

const ExpenseSplitCard = () => {
    return (
        <Card>
            <Flex direction="column" gap="4">
                <ExpenseSplitModeControl />
                <SplitTypeHeader />
                <ExpenseUsersList />
            </Flex>
        </Card>
    );
};

export default ExpenseSplitCard;
