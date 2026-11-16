import { useState } from 'react';
import { Button, Dialog, Flex } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { ROUTES } from 'constants/routes';
import type { Group } from 'entities/groups';
import { useAppNavigate } from 'hooks/useAppNavigate';
import { toastGroupWriteError, useCreateGroup, useUploadGroupCover } from 'hooks/useGroupMutations';

import { OverlayBody, OverlayFooter } from '../../../components';
import { useGroupCoverDraft } from '../../internal';
import { GroupCoverField, GroupCoverPickerControl } from '../group-cover-field';
import { GroupDetailsFields } from '../group-details-fields';

interface Props {
    onClose: () => void;
}

const CreateGroupForm = ({ onClose }: Props) => {
    const { t } = useTranslation('group');
    const navigate = useAppNavigate();
    const { createGroup, isPending: isCreatingGroup } = useCreateGroup();
    const { uploadGroupCover, isPending: isUploadingCover } = useUploadGroupCover();
    const isSaving = isCreatingGroup || isUploadingCover;
    const [inputName, setInputName] = useState('');
    const [inputDescription, setInputDescription] = useState('');
    const [createdGroupForRetry, setCreatedGroupForRetry] = useState<Group>();
    const isGroupCreated = Boolean(createdGroupForRetry);
    const {
        coverPreviewUrl,
        coverValidationError,
        selectedCoverFile,
        uploadProgress,
        onCoverChange,
        setUploadProgress,
    } = useGroupCoverDraft(isSaving);
    const uploadSelectedCover = (group: Group): Promise<Group> => {
        if (!selectedCoverFile) {
            return Promise.resolve(group);
        }

        setUploadProgress(0);

        return uploadGroupCover({
            groupId: group.id,
            file: selectedCoverFile,
            onProgress: setUploadProgress,
        }).catch((error: unknown) => {
            setUploadProgress(0);
            toastGroupWriteError(error, t('toasts:group.coverUploadError'));
            console.error('Error uploading group cover:', error);
            return Promise.reject(error);
        });
    };

    const onSaveSuccess = (savedGroup: Group) => {
        onClose();
        toast.success(t('toasts:group.created', { name: savedGroup.name }));
        navigate(`${ROUTES.GROUP}/${savedGroup.id}`);
    };

    const onClickSave = () => {
        const normalizedGroupName = inputName.trim();
        const normalizedDescription = inputDescription.trim();

        if (!normalizedGroupName) {
            return;
        }

        const createRequest = createdGroupForRetry
            ? Promise.resolve(createdGroupForRetry)
            : createGroup({
                  groupName: normalizedGroupName,
                  groupDescription: normalizedDescription || undefined,
              })
                  .then(group => {
                      setCreatedGroupForRetry(group);
                      return group;
                  })
                  .catch((error: unknown) => {
                      toastGroupWriteError(error, t('toasts:group.createError'));
                      console.error('Error creating group:', error);
                      return Promise.reject(error);
                  });

        createRequest.then(uploadSelectedCover).then(onSaveSuccess, () => {
            // The request stages already show the error and keep the form open.
        });
    };

    const coverPicker = (
        <GroupCoverPickerControl
            isOverlay={Boolean(coverPreviewUrl)}
            isSaving={isSaving}
            onCoverChange={onCoverChange}
        />
    );

    return (
        <>
            <OverlayBody>
                <Flex direction="column" gap="4">
                    <GroupCoverField
                        coverUrl={coverPreviewUrl}
                        coverValidationError={coverValidationError}
                        isUploadingCover={isUploadingCover}
                        pickerControl={coverPicker}
                        uploadProgress={uploadProgress}
                    />

                    <GroupDetailsFields
                        coverPicker={coverPreviewUrl ? undefined : coverPicker}
                        description={inputDescription}
                        isDescriptionCollapsible
                        isSaving={isSaving || isGroupCreated}
                        name={inputName}
                        onDescriptionChange={setInputDescription}
                        onNameChange={setInputName}
                    />
                </Flex>
            </OverlayBody>

            <OverlayFooter
                cancelAction={
                    <Dialog.Close>
                        <Button size="3" variant="soft" color="gray" disabled={isSaving}>
                            {t('common:buttons.cancel')}
                        </Button>
                    </Dialog.Close>
                }
                primaryAction={
                    <Button
                        size="3"
                        variant="solid"
                        disabled={!inputName.trim() || coverValidationError !== null || isSaving}
                        loading={isSaving}
                        onClick={onClickSave}
                    >
                        {isGroupCreated ? t('modal.cover.retry') : t('common:buttons.createGroup')}
                    </Button>
                }
            />
        </>
    );
};

export default CreateGroupForm;
