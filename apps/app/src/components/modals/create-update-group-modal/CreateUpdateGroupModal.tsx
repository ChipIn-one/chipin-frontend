import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Group } from 'entities/groups';
import { useIsGroupFormSaving } from 'hooks/useGroupMutations';

import { BaseModal, MODAL_SIZES } from '../base-modal';

import { CreateGroupForm, UpdateGroupForm } from './components';

type Props = { children: React.ReactNode } & (
    { type: 'create' } | { type: 'update'; /** The group being edited. */ group: Group }
);

const CreateUpdateGroupModal = ({ children, ...target }: Props) => {
    const { t } = useTranslation('group');
    const isCreateMode = target.type === 'create';
    const isSaving = useIsGroupFormSaving();
    const [isModalOpened, setIsModalOpened] = useState(false);

    const formKey = isModalOpened ? (target.type === 'create' ? 'create' : target.group.id) : null;

    const onOpenChange = (isOpen: boolean) => {
        if (!isOpen && isSaving) {
            return;
        }

        setIsModalOpened(isOpen);
    };

    return (
        <BaseModal
            isOpened={isModalOpened}
            setIsOpened={onOpenChange}
            triggerElement={children}
            title={isCreateMode ? t('modal.titleCreate') : t('modal.titleEdit')}
            accessibleDescription={
                isCreateMode ? t('modal.descriptionCreate') : t('modal.descriptionEdit')
            }
            maxWidth={MODAL_SIZES.default}
            isCloseDisabled={isSaving}
            content={
                target.type === 'create' ? (
                    <CreateGroupForm
                        key={String(formKey)}
                        onClose={() => setIsModalOpened(false)}
                    />
                ) : (
                    <UpdateGroupForm
                        key={String(formKey)}
                        group={target.group}
                        onClose={() => setIsModalOpened(false)}
                    />
                )
            }
        />
    );
};

export default CreateUpdateGroupModal;
