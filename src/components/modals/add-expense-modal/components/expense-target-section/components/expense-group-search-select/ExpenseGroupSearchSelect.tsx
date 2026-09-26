import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import type { Group } from 'api/chipin.types';
import { useExpenseModalStore } from 'store/expenseModalStore';
import { useGroupsStore } from 'store/groupsStore';

import GroupAvatar from 'components/GroupAvatar';
import { SearchSelect, type SearchSelectItem } from 'components/search-select';

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
    let selectedGroup: Group | undefined;
    const items: SearchSelectItem[] = [];

    for (const group of groups) {
        if (group.id === groupId) {
            selectedGroup = group;
        }

        items.push({
            value: group.id,
            label: group.name,
            icon: <GroupAvatar group={group} size="2" />,
            searchFields: [group.name],
        });
    }

    return (
        <SearchSelect
            items={items}
            value={groupId}
            searchPlaceholder={t('expenses.modal.groupSearchPlaceholder')}
            emptyText={t('expenses.modal.noGroups')}
            triggerElement={
                <ExpenseSearchSelectContent
                    icon={
                        selectedGroup ? <GroupAvatar group={selectedGroup} size="2" /> : null
                    }
                    title={t('expenses.modal.fields.group')}
                    value={selectedGroup?.name ?? t('expenses.modal.fields.group')}
                />
            }
            onChange={setGroupId}
        />
    );
};

export default ExpenseGroupSearchSelect;
