import { Card, Flex } from '@radix-ui/themes';

import {
    ExpenseSplitModeControl,
    ExpenseUsersList,
    SplitTypeHeader,
} from './components';

const ExpenseSplitCard = () => (
    <Card>
        <Flex direction="column" gap="4">
            <ExpenseSplitModeControl />
            <SplitTypeHeader />
            <ExpenseUsersList />
        </Flex>
    </Card>
);

export default ExpenseSplitCard;
