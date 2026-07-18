import { UserAvatar } from 'basics';

import type { User } from 'api/chipin.types';

import { SearchSelect } from 'components/search-select';

import ExpenseActionSelectTrigger from './ExpenseActionSelectTrigger';

interface Props {
    members: User[];
    value: string;
    currentUserId?: string;
    title: string;
    currentUserLabel: string;
    searchPlaceholder: string;
    emptyText: string;
    onChange: (value: string) => void;
}

const ExpensePayerSearchSelect = ({
    members,
    value,
    currentUserId,
    title,
    currentUserLabel,
    searchPlaceholder,
    emptyText,
    onChange,
}: Props) => {
    const items = members.map(member => {
        const label = member.id === currentUserId ? currentUserLabel : member.displayName;

        return {
            value: member.id,
            label,
            icon: <UserAvatar size="1" user={member} />,
            searchFields: [label, member.displayName],
        };
    });
    const selectedMember = members.find(member => member.id === value);
    const selectedLabel =
        selectedMember?.id === currentUserId
            ? currentUserLabel
            : selectedMember?.displayName ?? currentUserLabel;

    return (
        <SearchSelect
            items={items}
            value={value}
            searchPlaceholder={searchPlaceholder}
            emptyText={emptyText}
            triggerElement={
                <ExpenseActionSelectTrigger
                    icon={selectedMember ? <UserAvatar size="1" user={selectedMember} /> : null}
                    title={title}
                    value={selectedLabel}
                />
            }
            onChange={onChange}
        />
    );
};

export default ExpensePayerSearchSelect;
