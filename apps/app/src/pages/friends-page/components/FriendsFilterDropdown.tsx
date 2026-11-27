import { Box, Button } from '@radix-ui/themes';
import { ChevronDownIcon, FilterIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { DropdownMenuSection } from 'basics/Dropdown';
import { Dropdown } from 'basics/Dropdown';

interface Props {
    currencies: string[];
    filterKey: string;
    onFilterChange: (key: string) => void;
}

const FriendsFilterDropdown = ({ currencies, filterKey, onFilterChange }: Props) => {
    const { t } = useTranslation('friends');

    const label = filterKey === 'all' ? t('filter.allCurrencies') : filterKey;
    // Below `sm` the button shares the row with the search field, so it shows the short value.
    const shortLabel = filterKey === 'all' ? t('filter.all') : filterKey;

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
                <Button
                    variant="soft"
                    color="gray"
                    size="3"
                    aria-label={t('filter.byCurrency', { value: label })}
                >
                    <FilterIcon size={16} />
                    <Box display={{ initial: 'contents', sm: 'none' }}>{shortLabel}</Box>
                    <Box display={{ initial: 'none', sm: 'contents' }}>{label}</Box>
                    <ChevronDownIcon size={16} />
                </Button>
            }
        />
    );
};

export { FriendsFilterDropdown };
