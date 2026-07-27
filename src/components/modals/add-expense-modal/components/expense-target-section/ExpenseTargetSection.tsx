import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import { Card, Flex } from '@radix-ui/themes';

import {
    type ExpenseTargetMode,
    useExpenseModalStore,
} from 'store/expenseModalStore';

import SegmentedControl from 'components/SegmentedControl';

import { ExpenseGroupSearchSelect, ExpensePayerSearchSelect } from './components';

const ExpenseTargetSection = () => {
    const { t } = useTranslation('group');
    const {
        targetMode,
        isTabsVisible,
        isGroupSelectVisible,
        setTargetMode,
    } = useExpenseModalStore(
        useShallow(state => ({
            targetMode: state.targetMode,
            isTabsVisible: state.source.context === 'dashboard',
            isGroupSelectVisible:
                state.source.context === 'dashboard' &&
                state.targetMode === 'group',
            setTargetMode: state.setTargetMode,
        })),
    );

    return (
        <>
            {isTabsVisible && (
                <Card>
                    <Flex direction="column" gap="4">
                        <SegmentedControl
                            value={targetMode}
                            items={[
                                {
                                    value: 'group',
                                    label: t('expenses.modal.tabs.group'),
                                },
                                {
                                    value: 'friends',
                                    label: t('expenses.modal.tabs.friends'),
                                },
                            ]}
                            onValueChange={value =>
                                setTargetMode(value as ExpenseTargetMode)
                            }
                        />

                        {isGroupSelectVisible && <ExpenseGroupSearchSelect />}
                    </Flex>
                </Card>
            )}

            <ExpensePayerSearchSelect />
        </>
    );
};

export default ExpenseTargetSection;
