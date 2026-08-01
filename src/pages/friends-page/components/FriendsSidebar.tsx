import { Flex } from '@radix-ui/themes';

import FriendsPageHeader from './FriendsPageHeader';
import FriendsSearchBar from './FriendsSearchBar';

interface Props {
    currencies: string[];
    filterKey: string;
    isLoading: boolean;
    onFilterChange: (key: string) => void;
    onSearchChange: (value: string) => void;
    search: string;
}

const FriendsSidebar = ({
    currencies,
    filterKey,
    isLoading,
    onFilterChange,
    onSearchChange,
    search,
}: Props) => (
    <Flex direction="column" gap="4">
        <FriendsPageHeader isLoading={isLoading} />
        <FriendsSearchBar
            search={search}
            onSearchChange={onSearchChange}
            currencies={currencies}
            filterKey={filterKey}
            onFilterChange={onFilterChange}
            isLoading={isLoading}
        />
    </Flex>
);

export default FriendsSidebar;
