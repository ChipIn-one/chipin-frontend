import type { Group } from 'api/chipin.types';

import { SearchSelect } from 'components/search-select';

import ExpenseActionSelectTrigger from './ExpenseActionSelectTrigger';

interface Props {
    groups: Group[];
    value: string;
    title: string;
    searchPlaceholder: string;
    emptyText: string;
    onChange: (value: string) => void;
}

const ExpenseGroupSearchSelect = ({
    groups,
    value,
    title,
    searchPlaceholder,
    emptyText,
    onChange,
}: Props) => {
    const selectedGroup = groups.find(group => group.id === value);
    const items = groups.map(group => ({
        value: group.id,
        label: group.name,
        icon: group.emoji,
        searchFields: [group.name, group.emoji ?? ''],
    }));

    return (
        <SearchSelect
            items={items}
            value={value}
            searchPlaceholder={searchPlaceholder}
            emptyText={emptyText}
            triggerElement={
                <ExpenseActionSelectTrigger
                    icon={selectedGroup?.emoji ?? null}
                    title={title}
                    value={selectedGroup?.name ?? title}
                />
            }
            onChange={onChange}
        />
    );
};

export default ExpenseGroupSearchSelect;
