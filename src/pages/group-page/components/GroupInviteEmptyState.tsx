import { LucideUserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Flex } from '@radix-ui/themes';

import type { Group } from 'api/chipin.types';

import { EmptyState } from 'basics/empty-states';

import GroupInviteActions from './GroupInviteActions';

interface Props {
    group: Group;
}

const GroupInviteEmptyState = ({ group }: Props) => {
    const { t } = useTranslation('group');

    return (
        <Flex direction="column" gap="3">
            <EmptyState
                icon={<LucideUserPlus size={16} />}
                iconColor="indigo"
                title={t('page.expenses.inviteTitle')}
                description={t('page.expenses.inviteDescription')}
            />
            <GroupInviteActions group={group} />
        </Flex>
    );
};

export default GroupInviteEmptyState;
