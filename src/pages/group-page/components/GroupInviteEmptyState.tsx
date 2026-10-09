import { LucideUserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@radix-ui/themes';

import type { Group } from 'api/chipin.types';
import { useGroupInvite } from 'hooks/pwaHooks';

import { EmptyState } from 'basics/empty-states';

interface Props {
    group: Group;
}

const GroupInviteEmptyState = ({ group }: Props) => {
    const { t } = useTranslation('group');
    const invite = useGroupInvite(group);
    const onInvite = (): Promise<void> =>
        invite.isNativeShareSupported
            ? invite.onShare()
            : invite.onCopyLink();

    return (
        <EmptyState
            icon={<LucideUserPlus size={20} />}
            title={t('page.expenses.inviteTitle')}
            description={t('page.expenses.inviteDescription')}
            action={
                <Button type="button" size="2" variant="soft" onClick={onInvite}>
                    <LucideUserPlus size={16} />
                    {t('page.membersTab.invitePeople')}
                </Button>
            }
        />
    );
};

export default GroupInviteEmptyState;
