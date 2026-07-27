import { useState } from 'react';
import { t } from 'i18next';
import { LucideTriangleAlert } from 'lucide-react';
import { toast } from 'sonner';

import { Button, Callout, Dialog, Flex, Text } from '@radix-ui/themes';

import type { GroupUser } from 'api/chipin.types';
import { useGroupsStore } from 'store/groupsStore';
import { selectGroupKicking } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

import { BaseModal, MODAL_SIZES } from './base-modal';

interface Props {
    children: React.ReactNode;
    member: GroupUser;
}

const KickGroupMemberModal = ({ children, member }: Props) => {
    const { kickGroupMember } = useGroupsStore();
    const isKickingMember = useLoadingStore(selectGroupKicking);
    const [isModalOpened, setIsModalOpened] = useState(false);

    const onKickGroupMember = () => {
        kickGroupMember({ userId: member.id })
            .then(memberDisplayName => {
                setIsModalOpened(false);
                toast.success(t('toasts:group.kicked', { name: memberDisplayName }));
            })
            .catch(() => {
                toast.error(t('toasts:group.kickError'));
            });
    };

    return (
        <BaseModal
            isOpened={isModalOpened}
            setIsOpened={setIsModalOpened}
            triggerElement={children}
            title={t('group:kickModal.title')}
            maxWidth={MODAL_SIZES.default}
            content={
                <Flex direction="column" gap="6">
                    <Text size="4">
                        {t('group:kickModal.confirm', { name: member.displayName })}
                    </Text>

                    <Callout.Root color="amber" size="2">
                        <Callout.Icon>
                            <LucideTriangleAlert size={18} />
                        </Callout.Icon>
                        <Callout.Text>{t('group:kickModal.transferExpensesWarning')}</Callout.Text>
                    </Callout.Root>

                    <Flex justify="end" gap="4">
                        <Dialog.Close>
                            <Button size="3" variant="soft" color="gray">
                                {t('buttons.cancel')}
                            </Button>
                        </Dialog.Close>

                        <Button
                            size="3"
                            variant="solid"
                            color="orange"
                            onClick={onKickGroupMember}
                            loading={isKickingMember}
                        >
                            {t('common:buttons.kickMember')}
                        </Button>
                    </Flex>
                </Flex>
            }
        />
    );
};

export default KickGroupMemberModal;
