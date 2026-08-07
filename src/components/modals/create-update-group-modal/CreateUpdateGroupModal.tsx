import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useGroupsStore } from 'store/groupsStore';
import {
    selectGroupAdding,
    selectGroupCoverUploading,
    selectGroupUpdating,
} from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

import { BaseModal, MODAL_SIZES } from '../base-modal';

import { CreateGroupForm, UpdateGroupForm } from './components';

interface Props {
    children: React.ReactNode;
    type: 'create' | 'update';
}

const CreateUpdateGroupModal = ({ children, type }: Props) => {
    const { t } = useTranslation('group');
    const selectedGroup = useGroupsStore(state => state.selectedGroup);
    const isCreateMode = type === 'create';
    const isCreatingGroup = useLoadingStore(selectGroupAdding);
    const isUpdatingGroup = useLoadingStore(selectGroupUpdating);
    const isUploadingCover = useLoadingStore(selectGroupCoverUploading);
    const isSaving = isCreatingGroup || isUpdatingGroup || isUploadingCover;
    const [isModalOpened, setIsModalOpened] = useState(false);

    const formKey = isModalOpened
        ? isCreateMode
            ? 'create'
            : (selectedGroup?.id ?? 'update')
        : null;

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
                isCreateMode ? (
                    <CreateGroupForm
                        key={String(formKey)}
                        onClose={() => setIsModalOpened(false)}
                    />
                ) : (
                    <UpdateGroupForm
                        key={String(formKey)}
                        onClose={() => setIsModalOpened(false)}
                    />
                )
            }
        />
    );
};

export default CreateUpdateGroupModal;
