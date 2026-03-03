import { useState } from 'react';
import { t } from 'i18next';
import { LucideOctagonAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Button, Callout, Dialog, Flex, Text } from '@radix-ui/themes';

import { ROUTES } from 'constants/routes';
import { useGroupsStore } from 'store/groupsStore';
import { useLoadingStore } from 'store/loadingStore';

import BaseModal from './BaseModal';

interface Props {
    children: React.ReactNode;
}

const RemoveGroupModal = ({ children }: Props) => {
    const navigate = useNavigate();
    const { removeGroup } = useGroupsStore();
    const isRemovingGroup = useLoadingStore(state => state.group.remove);
    const [isModalOpened, setIsModalOpened] = useState(false);

    const onRemoveGroup = () => {
        removeGroup()
            .then(groupName => {
                setIsModalOpened(false);
                toast.success(`Group "${groupName}" was successfully removed!`);
                navigate(ROUTES.DASHBOARD, { replace: true });
            })
            .catch(() => {
                toast.error(`Something went wrong while removing the group.`);
            });
    };

    return (
        <BaseModal
            isOpened={isModalOpened}
            setIsOpened={setIsModalOpened}
            triggerElement={children}
            title="Delete group"
            maxWidth="480px"
            content={
                <Flex direction="column" gap="6">
                    <Text size="4">Are you sure you want to delete this group?</Text>
                    <Callout.Root color="red" size="2">
                        <Callout.Icon>
                            <LucideOctagonAlert size={20} />
                        </Callout.Icon>
                        <Callout.Text>
                            This action cannot be undone. All group data will be permanently
                            deleted.
                        </Callout.Text>
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
