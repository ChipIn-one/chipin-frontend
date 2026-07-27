import { useState } from 'react';
import { t } from 'i18next';
import { LucideOctagonAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Button, Callout, Dialog, Flex, Text } from '@radix-ui/themes';

import { ROUTES } from 'constants/routes';
import { useGroupsStore } from 'store/groupsStore';
import { selectGroupRemoving } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

import { BaseModal, MODAL_SIZES } from './base-modal';

interface Props {
    children: React.ReactNode;
}
// TODO: Refactor to alert dialog
const RemoveGroupModal = ({ children }: Props) => {
    const navigate = useNavigate();
    const { removeGroup } = useGroupsStore();
    const isRemovingGroup = useLoadingStore(selectGroupRemoving);
    const [isModalOpened, setIsModalOpened] = useState(false);

    const onRemoveGroup = () => {
        removeGroup()
            .then(groupName => {
                setIsModalOpened(false);
                toast.success(t('toasts:group.removed', { name: groupName }));
                navigate(ROUTES.DASHBOARD, { replace: true });
            })
            .catch(() => {
                toast.error(t('toasts:group.removeError'));
            });
    };

    return (
        <BaseModal
            isOpened={isModalOpened}
            setIsOpened={setIsModalOpened}
            triggerElement={children}
            title={t('group:removeModal.title')}
            maxWidth={MODAL_SIZES.default}
            content={
                <Flex direction="column" gap="6">
                    <Text size="4">{t('group:removeModal.confirm')}</Text>
                    <Callout.Root color="red" size="2">
                        <Callout.Icon>
                            <LucideOctagonAlert size={20} />
                        </Callout.Icon>
                        <Callout.Text>{t('group:removeModal.warning')}</Callout.Text>
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
                            color="red"
                            onClick={onRemoveGroup}
                            loading={isRemovingGroup}
                        >
                            {t('buttons.delete')}
                        </Button>
                    </Flex>
                </Flex>
            }
        />
    );
};

export default RemoveGroupModal;
