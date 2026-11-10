import { useState } from 'react';
import { Button, Dialog, Flex } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useShallow } from 'zustand/react/shallow';

import type { Group as LegacyGroup } from 'api/chipin.types';
import type { Group } from 'entities/groups';
import { resolveApiErrorMessageFromError } from 'helpers/errors';
import { useGroupsStore } from 'store/groupsStore';
import { selectGroupCoverUploading, selectGroupUpdating } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

import { OverlayBody, OverlayFooter } from '../../../components';
import { useGroupCoverDraft } from '../../internal';
import { GroupCoverField, GroupCoverPickerControl } from '../group-cover-field';
import { GroupDetailsFields } from '../group-details-fields';

interface Props {
    /** The group being edited. */
    group: Group;
    onClose: () => void;
}

const UpdateGroupForm = ({ group: editedGroup, onClose }: Props) => {
    const { t } = useTranslation('group');
    const { updateGroup, uploadGroupCover } = useGroupsStore(
        useShallow(state => ({
            updateGroup: state.updateGroup,
            uploadGroupCover: state.uploadGroupCover,
        })),
    );
    const isUpdatingGroup = useLoadingStore(selectGroupUpdating);
    const isUploadingCover = useLoadingStore(selectGroupCoverUploading);
    const isSaving = isUpdatingGroup || isUploadingCover;
    const [inputName, setInputName] = useState(editedGroup.name);
    const [inputDescription, setInputDescription] = useState(editedGroup.description ?? '');
    const {
        coverPreviewUrl,
        coverValidationError,
        selectedCoverFile,
        uploadProgress,
        onCoverChange,
        setUploadProgress,
    } = useGroupCoverDraft(isSaving);

    const uploadSelectedCover = (group: LegacyGroup): Promise<LegacyGroup> => {
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
            toast.error(resolveApiErrorMessageFromError(error, t('toasts:group.coverUploadError')));
            console.error('Error uploading group cover:', error);
            return Promise.reject(error);
        });
    };

    const onSaveSuccess = (savedGroup: LegacyGroup) => {
        onClose();
        toast.success(t('toasts:group.updated', { name: savedGroup.name }));
    };

    const onClickSave = () => {
        const normalizedGroupName = inputName.trim();
        const normalizedDescription = inputDescription.trim();

        if (!normalizedGroupName) {
            return;
        }

        updateGroup({
            groupId: editedGroup.id,
            groupName: normalizedGroupName,
            groupDescription: normalizedDescription,
        })
            .catch((error: unknown) => {
                toast.error(resolveApiErrorMessageFromError(error, t('toasts:group.updateError')));
                console.error('Error updating group:', error);
                return Promise.reject(error);
            })
            .then(uploadSelectedCover)
            .then(onSaveSuccess, () => {
                // The request stages already show the error and keep the form open.
            });
    };

    const coverUrl = coverPreviewUrl ?? editedGroup.coverUrl;
    const coverPicker = (
        <GroupCoverPickerControl
            isOverlay={Boolean(coverUrl)}
            isSaving={isSaving}
            onCoverChange={onCoverChange}
        />
    );

    return (
        <>
            <OverlayBody>
                <Flex direction="column" gap="4">
                    <GroupCoverField
                        coverUrl={coverUrl}
                        coverValidationError={coverValidationError}
                        isUploadingCover={isUploadingCover}
                        pickerControl={coverPicker}
                        uploadProgress={uploadProgress}
                    />

                    <GroupDetailsFields
                        coverPicker={coverUrl ? undefined : coverPicker}
                        description={inputDescription}
                        isSaving={isSaving}
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
                        {t('common:buttons.saveGroup')}
                    </Button>
                }
            />
        </>
    );
};

export default UpdateGroupForm;
