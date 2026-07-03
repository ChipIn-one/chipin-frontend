import { LucidePencil, LucideTrash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Box, Button, Flex, Text } from '@radix-ui/themes';

import type { AppEvent } from 'api/activity.types';

import { EventRenderer } from './components';
import { getActivityChildCategory } from './selectors';

interface Props {
    parentEvent?: AppEvent;
    isDeleting: boolean;
    canDelete: boolean;
    onDelete: () => void;
}

const ActivityChildrenHeader = ({ parentEvent, isDeleting, canDelete, onDelete }: Props) => {
    const { t } = useTranslation('activity');

    if (!parentEvent) {
        return null;
    }

    const childCategory = getActivityChildCategory(parentEvent);
    const title =
        childCategory === 'settlement'
            ? t('childSettlementHistoryTitle')
            : t('childExpenseHistoryTitle');

    return (
        <Box mb="4">
            <Flex
                justify="between"
                align={{ initial: 'start', sm: 'center' }}
                gap="3"
                mb="2"
                direction={{ initial: 'column', sm: 'row' }}
            >
                <Text size="2" color="gray" weight="medium">
                    {title}
                </Text>

                <Flex align="center" gap="2" wrap="wrap">
                    <Button size="1" variant="soft" disabled>
                        <LucidePencil size={14} />
                        {t('childUpdateAction')}
                    </Button>

                    <Button
                        size="1"
                        variant="soft"
                        color="red"
                        disabled={!canDelete || isDeleting}
                        onClick={onDelete}
                    >
                        <LucideTrash2 size={14} />
                        {t('childDeleteAction')}
                    </Button>
                </Flex>
            </Flex>

            <EventRenderer event={parentEvent} />
        </Box>
    );
};

export default ActivityChildrenHeader;
