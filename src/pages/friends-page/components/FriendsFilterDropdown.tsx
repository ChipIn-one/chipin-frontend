import { LucideChevronDown, LucideFilter } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Box, Button } from '@radix-ui/themes';

import type { DropdownMenuSection } from 'components/Dropdown';
import Dropdown from 'components/Dropdown';

interface Props {
    currencies: string[];
    filterKey: string;
    onFilterChange: (key: string) => void;
}

const FriendsFilterDropdown = ({ currencies, filterKey, onFilterChange }: Props) => {
    const { t } = useTranslation('friends');

    const label = filterKey === 'all' ? t('filter.allCurrencies') : filterKey;

    const sections: DropdownMenuSection[] = [
        {
            items: [{ value: 'all', label: t('filter.allCurrencies') }],
        },
        ...(currencies.length > 0
            ? [
                  {
                      items: currencies.map(currency => ({
                          value: currency,
                          label: currency,
                      })),
                  },
              ]
            : []),
    ];

    return (
        <Dropdown
            sections={sections}
            value={filterKey}
            onValueChange={onFilterChange}
            align="end"
            trigger={
                <Button variant="soft" color="gray" size="3">
                    <LucideFilter size={16} />
                    <Box display={{ initial: 'none', sm: 'contents' }}>{label}</Box>
                    <Box display={{ initial: 'none', sm: 'contents' }}>
                        <LucideChevronDown size={16} />
                    </Box>
                </Button>
            }
        />
    );
};

export default FriendsFilterDropdown;
