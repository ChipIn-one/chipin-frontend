import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import styled from 'styled-components';

import {
    Box,
    Button,
    Dialog,
    Flex,
    IconButton,
    ScrollArea,
    Text,
    TextArea,
    TextField,
} from '@radix-ui/themes';

import { themeColor } from 'helpers/colors';
import { isInputCloseToLimit } from 'helpers/text';
import { useGroupsStore } from 'store/groupsStore';
import { selectGroupAdding, selectGroupUpdating } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

import BaseModal from '../BaseModal';

import {
    ALL_GROUP_ICONS,
    DEFAULT_CATEGORY_KEY,
    DEFAULT_ICON,
    GROUP_DESCRIPTION_MAX_LENGTH,
    GROUP_ICON_CATEGORIES,
    GROUP_NAME_MAX_LENGTH,
    GroupIconCategoryKey,
} from './constants';

interface Props {
    children: React.ReactNode;
    type: 'create' | 'update';
}

const FieldLabel = styled(Text)`
    text-transform: uppercase;
`;

const CategoryButton = styled(Button)`
    flex-shrink: 0;
`;

const IconPanel = styled(Box)`
    border: 1px solid ${themeColor('gray6')};
    border-radius: var(--radius-5);
`;

const IconsGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: var(--space-2);
    width: 100%;
`;

const EmojiChoiceButton = styled(IconButton)<{ $selected: boolean }>`
    && {
        width: 100%;
        min-width: 100%;
        height: var(--space-9);
        min-height: var(--space-9);
        max-height: var(--space-9);
        padding: 0;
        margin: 0;
        box-sizing: border-box;
    }

    &.rt-variant-ghost {
        padding: 0;
        margin: 0;
        box-sizing: border-box;
        border: 1px solid transparent;
    }
`;

const GroupNameField = styled(TextField.Root)`
    width: 100%;
    min-height: var(--space-8);
`;

const resolveCategoryFromEmoji = (emoji?: string): GroupIconCategoryKey => {
    if (!emoji) {
        return DEFAULT_CATEGORY_KEY;
    }

    return (
        GROUP_ICON_CATEGORIES.find(category => category.icons.includes(emoji))?.key ??
        DEFAULT_CATEGORY_KEY
    );
};

interface FormProps {
    type: 'create' | 'update';
    onClose: () => void;
}

const GroupForm = ({ type, onClose }: FormProps) => {
    const { t } = useTranslation('group');
    const { createGroup, updateGroup, selectedGroup } = useGroupsStore();
    const isCreatingGroup = useLoadingStore(selectGroupAdding);
    const isUpdatingGroup = useLoadingStore(selectGroupUpdating);
    const isCreateMode = type === 'create';

    const initialEmoji = isCreateMode ? DEFAULT_ICON : (selectedGroup?.emoji ?? DEFAULT_ICON);

    const [inputName, setInputName] = useState(isCreateMode ? '' : (selectedGroup?.name ?? ''));
    const [inputDescription, setInputDescription] = useState(
        isCreateMode ? '' : (selectedGroup?.description ?? ''),
    );
    const isInputNameCloseToLimit = isInputCloseToLimit(inputName.length, GROUP_NAME_MAX_LENGTH);
    const isInputDescriptionCloseToLimit = isInputCloseToLimit(
        inputDescription.length,
        GROUP_DESCRIPTION_MAX_LENGTH,
    );

    const [selectedEmoji, setSelectedEmoji] = useState(initialEmoji);
    const [selectedCategory, setSelectedCategory] = useState<GroupIconCategoryKey>(
        resolveCategoryFromEmoji(initialEmoji),
    );

    const selectedCategoryIcons = useMemo(
        () =>
            GROUP_ICON_CATEGORIES.find(category => category.key === selectedCategory)?.icons ??
            ALL_GROUP_ICONS,
        [selectedCategory],
    );

    const onSelectCategory = (categoryKey: GroupIconCategoryKey) => {
        setSelectedCategory(categoryKey);
    };

    const onClickSave = () => {
        const normalizedGroupName = inputName.trim();
        const normalizedDescription = inputDescription.trim();

        if (!normalizedGroupName) {
            return;
        }

        if (isCreateMode) {
            createGroup({
                groupName: normalizedGroupName,
                groupDescription: normalizedDescription || undefined,
                groupEmoji: selectedEmoji,
            })
                .then(group => {
                    onClose();
                    toast.success(t('toasts:group.created', { name: group.name }));
                })
                .catch(error => {
                    toast.error(t('toasts:group.createError'));
                    console.error('Error creating group:', error);
                });
        } else {
            updateGroup({
                groupName: normalizedGroupName,
                groupDescription: normalizedDescription || undefined,
                groupEmoji: selectedEmoji,
            })
                .then(updatedGroup => {
                    onClose();
                    toast.success(t('toasts:group.updated', { name: updatedGroup.name }));
                })
                .catch(error => {
                    toast.error(t('toasts:group.updateError'));
                    console.error('Error updating group:', error);
                });
        }
    };

    return (
        <Flex direction="column" gap="4">
            <Flex direction="column" gap="2">
                <Flex align="center" justify="between" gap="3">
                    <FieldLabel size="3" weight="bold">
                        {t('modal.fields.nameLabel')}
                    </FieldLabel>
                    <Box display={isInputNameCloseToLimit ? 'block' : 'none'}>
                        <Text size="2" color="gray">
                            {inputName.length}/{GROUP_NAME_MAX_LENGTH}
                        </Text>
                    </Box>
                </Flex>

                <Flex align="stretch" gap="3">
                    <IconButton variant="outline" size="4" color="jade">
                        <Text size="7">{selectedEmoji}</Text>
                    </IconButton>

                    <GroupNameField
                        maxLength={GROUP_NAME_MAX_LENGTH}
                        required
                        size="3"
                        radius="large"
                        color={isInputNameCloseToLimit ? 'yellow' : undefined}
                        variant={isInputNameCloseToLimit ? 'soft' : 'classic'}
                        placeholder={t('modal.fields.namePlaceholder')}
                        type="text"
                        value={inputName}
                        onChange={e => setInputName(e.target.value)}
                    />
                </Flex>
            </Flex>

            <Flex direction="column" gap="2">
                <Flex align="center" justify="between" gap="3">
                    <Flex align="center" gap="2">
                        <FieldLabel size="2" weight="bold">
                            {t('modal.fields.descriptionLabel')}
                        </FieldLabel>
                        <Text size="2" color="gray">
                            {t('modal.fields.descriptionOptional')}
                        </Text>
                    </Flex>
                    <Box display={isInputDescriptionCloseToLimit ? 'block' : 'none'}>
                        <Text size="2" color="gray">
                            {inputDescription.length}/{GROUP_DESCRIPTION_MAX_LENGTH}
                        </Text>
                    </Box>
                </Flex>

                <TextArea
                    size="3"
                    radius="large"
                    maxLength={GROUP_DESCRIPTION_MAX_LENGTH}
                    placeholder={t('modal.fields.descriptionPlaceholder')}
                    value={inputDescription}
                    onChange={e => setInputDescription(e.target.value)}
                    color={isInputDescriptionCloseToLimit ? 'yellow' : undefined}
                    variant={isInputDescriptionCloseToLimit ? 'soft' : 'classic'}
                />
            </Flex>

            <Flex direction="column" gap="3">
                <Flex align="center" justify="between" gap="3">
                    <FieldLabel size="2" weight="bold">
                        {t('modal.fields.iconLabel')}
                    </FieldLabel>
                </Flex>

                <ScrollArea scrollbars="horizontal" type="always">
                    <Flex gap="2" mb="3">
                        {GROUP_ICON_CATEGORIES.map(category => (
                            <CategoryButton
                                key={category.key}
                                type="button"
                                size="2"
                                radius="full"
                                variant={selectedCategory === category.key ? 'solid' : 'surface'}
                                color={selectedCategory === category.key ? 'jade' : 'gray'}
                                onClick={() => onSelectCategory(category.key)}
                            >
                                {t(category.labelKey)}
                            </CategoryButton>
                        ))}
                    </Flex>
                </ScrollArea>

                <IconPanel p="2">
                    <IconsGrid>
                        {selectedCategoryIcons.map(icon => {
                            const isSelected = selectedEmoji === icon;

                            return (
                                <EmojiChoiceButton
                                    key={`${selectedCategory}-${icon}`}
                                    type="button"
                                    size="4"
                                    radius="large"
                                    variant={isSelected ? 'outline' : 'ghost'}
                                    color="jade"
                                    $selected={isSelected}
                                    onClick={() => setSelectedEmoji(icon)}
                                >
                                    <Text size="7">{icon}</Text>
                                </EmojiChoiceButton>
                            );
                        })}
                    </IconsGrid>
                </IconPanel>
            </Flex>

            <Flex justify="end" gap="3">
                <Dialog.Close>
                    <Button size="3" variant="soft" color="gray">
                        {t('common:buttons.cancel')}
                    </Button>
                </Dialog.Close>

                <Button
                    size="3"
                    variant="solid"
                    disabled={!inputName.trim() || isCreatingGroup || isUpdatingGroup}
                    loading={isCreatingGroup || isUpdatingGroup}
                    onClick={onClickSave}
                >
                    {isCreateMode ? t('modal.actions.create') : t('modal.actions.save')}
                </Button>
            </Flex>
        </Flex>
    );
};

const CreateUpdateGroupModal = ({ children, type }: Props) => {
    const { t } = useTranslation('group');
    const { selectedGroup } = useGroupsStore();
    const isCreateMode = type === 'create';

    const [isModalOpened, setIsModalOpened] = useState(false);

    const formKey = isModalOpened
        ? isCreateMode
            ? 'create'
            : (selectedGroup?.id ?? 'update')
        : null;

    return (
        <BaseModal
            isOpened={isModalOpened}
            setIsOpened={setIsModalOpened}
            triggerElement={children}
            title={isCreateMode ? t('modal.titleCreate') : t('modal.titleEdit')}
            maxWidth="480px"
            content={
                <GroupForm
                    key={String(formKey)}
                    type={type}
                    onClose={() => setIsModalOpened(false)}
                />
            }
        />
    );
};

export default CreateUpdateGroupModal;
