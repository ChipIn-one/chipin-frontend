import { Grid } from '@radix-ui/themes';

import { ExpenseAmountFields } from './components/expense-amount-fields/ExpenseAmountFields';
import ExpenseCurrencyCategoryFields from './components/expense-currency-category-fields/ExpenseCurrencyCategoryFields';

const ExpenseDetailsSection = () => (
    <Grid columns={{ initial: '1', sm: '2' }} gap="3" align="stretch">
        <ExpenseAmountFields />
        <ExpenseCurrencyCategoryFields />
    </Grid>
);

export default ExpenseDetailsSection;
