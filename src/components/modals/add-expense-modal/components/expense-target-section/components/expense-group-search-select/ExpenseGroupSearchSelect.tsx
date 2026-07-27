import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import { useExpenseModalStore } from 'store/expenseModalStore';
import { useGroupsStore } from 'store/groupsStore';

import { SearchSelect } from 'components/search-select';

import { ExpenseSearchSelectContent } from '../../../expense-search-select-content';

const ExpenseGroupSearchSelect = () => {
    const { t } = useTranslation('group');
    const groups = useGroupsStore(state => state.groups);
    const { groupId, setGroupId } = useExpenseModalStore(
        useShallow(state => ({
            groupId: state.groupId,
            setGroupId: state.setGroupId,
        })),
    );
    const selectedGroup = groups.find(group => group.id === groupId);
    const items = groups.map(group => ({
        value: group.id,
        label: group.name,
        icon: group.emoji,
        searchFields: [group.name],
    }));

    return (
        <SearchSelect
            items={items}
            value={groupId}
            searchPlaceholder={t('expenses.modal.groupSearchPlaceholder')}
            emptyText={t('expenses.modal.noGroups')}
            triggerElement={
                <ExpenseSearchSelectContent
                    icon={selectedGroup?.emoji ?? null}
                    title={t('expenses.modal.fields.group')}
                    value={selectedGroup?.name ?? t('expenses.modal.fields.group')}
                />
            }
            onChange={setGroupId}
        />
    );
};

export default ExpenseGroupSearchSelect;
