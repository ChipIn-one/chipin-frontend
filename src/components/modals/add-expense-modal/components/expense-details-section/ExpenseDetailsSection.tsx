import { Grid } from '@radix-ui/themes';

import {
    ExpenseAmountFields,
    ExpenseCurrencyCategoryFields,
} from './components';

const ExpenseDetailsSection = () => {
    return (
        <Grid columns={{ initial: '1', sm: '2' }} gap="3" align="stretch">
            <ExpenseAmountFields />
            <ExpenseCurrencyCategoryFields />
        </Grid>
    );
};

export default ExpenseDetailsSection;
