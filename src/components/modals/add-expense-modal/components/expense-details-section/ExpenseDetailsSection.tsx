import { Grid } from '@radix-ui/themes';

import { useExpenseModalStore } from 'store/expenseModalStore';

import {
    ExpenseAmountFields,
    ExpenseCurrencyCategoryFields,
    ExpenseDateField,
} from './components';

const ExpenseDetailsSection = () => {
    const mode = useExpenseModalStore(state => state.mode);

    return (
        <Grid columns={{ initial: '1', sm: '2' }} gap="3" align="stretch">
            <ExpenseAmountFields />
            <ExpenseCurrencyCategoryFields />
            {mode === 'create' && <ExpenseDateField />}
        </Grid>
    );
};

export default ExpenseDetailsSection;
