import { LucideSearch } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Box, Flex, Skeleton, TextField } from '@radix-ui/themes';

import FriendsFilterDropdown from './FriendsFilterDropdown';

interface Props {
    search: string;
    onSearchChange: (value: string) => void;
    currencies: string[];
    filterKey: string;
    onFilterChange: (key: string) => void;
    isLoading: boolean;
}

const FriendsSearchBar = ({
    search,
    onSearchChange,
    currencies,
    filterKey,
    onFilterChange,
    isLoading,
}: Props) => {
    const { t } = useTranslation('friends');

    return (
        <Skeleton loading={isLoading}>
            <Flex gap="2">
                <Box flexGrow="1">
                    <TextField.Root
                        placeholder={t('searchPlaceholder')}
                        value={search}
                        onChange={e => onSearchChange(e.target.value)}
                        size="3"
                    >
                        <TextField.Slot>
                            <LucideSearch size={16} />
                        </TextField.Slot>
                    </TextField.Root>
                </Box>
                <Flex flexBasis={{ sm: '33%' }} flexShrink="0" direction="column">
                    <FriendsFilterDropdown
                        currencies={currencies}
                        filterKey={filterKey}
                        onFilterChange={onFilterChange}
                    />
                </Flex>
            </Flex>
        </Skeleton>
    );
};

export default FriendsSearchBar;
