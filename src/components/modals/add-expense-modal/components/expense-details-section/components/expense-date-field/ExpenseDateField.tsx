import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import { Flex, Text, TextField } from '@radix-ui/themes';

import {
    formatUnixTimestampInSecForDateTimeInput,
    parseDateTimeInputToUnixTimestampInSec,
} from 'helpers/time';
import { useExpenseModalStore } from 'store/expenseModalStore';

const ExpenseDateField = () => {
    const { t } = useTranslation('group');
    const inputId = useId();
    const { date, setDate } = useExpenseModalStore(
        useShallow(state => ({ date: state.date, setDate: state.setDate })),
    );

    return (
        <Flex direction="column" gap="1">
            <Text as="label" htmlFor={inputId} size="2" weight="bold" color="gray">
                {t('common:fields.date')}
            </Text>
            <TextField.Root
                id={inputId}
                type="datetime-local"
                size="3"
                value={formatUnixTimestampInSecForDateTimeInput(date)}
                onChange={event => {
                    const nextDate = parseDateTimeInputToUnixTimestampInSec(event.target.value);

                    if (nextDate !== null) {
                        setDate(nextDate);
                    }
                }}
            />
        </Flex>
    );
};

export default ExpenseDateField;
