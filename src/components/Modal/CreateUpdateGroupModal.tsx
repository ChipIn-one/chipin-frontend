import { useMemo, useState } from 'react';
import { t } from 'i18next';
import { toast } from 'sonner';

import { Button, Dialog, Flex, IconButton, Text, TextArea, TextField } from '@radix-ui/themes';

import { useGroupsStore } from 'store/groupsStore';
import { useLoadingStore } from 'store/loadingStore';

import BaseModal from './BaseModal';

interface Props {
    children: React.ReactNode;
    type: 'create' | 'update';
}

const GROUP_ICONS = [
    '👥',
    '🤝',
    '📌',
    '🧩',
    '🗂️',
    '🔗',

    '💸',
    '💰',
    '⚖️',
    '🏦',
    '🪙',

    '🍕',
    '🍻',
    '☕',
    '🏠',
    '🚗',
    '✈️',
    '🛒',
    '🎉',
    '🎂',
    '🎮',
    '🎬',
    '🏕️',

    '🐸',
    '🦥',
    '🐷',
    '🤡',
    '🔥',
    '💀',
    '🙃',
    '😵‍💫',
    '🤯',
    '😬',
    '😂',
    '👀',
    '🫠',
    '🧠',

    '🌀',
    '🪐',
    '🧭',
];

const CreateUpdateGroupModal = ({ children, type }: Props) => {
    const { createGroup, updateGroup, selectedGroup } = useGroupsStore();
    const isCreatingGroup = useLoadingStore(state => state.group.add);
    const isUpdatingGroup = useLoadingStore(state => state.group.update);
    const isCreateMode = type === 'create';

    const [isModalOpened, setIsModalOpened] = useState(false);
    const [inputGroupName, setInputGroupName] = useState(
        isCreateMode ? '' : selectedGroup?.name || '',
    );
    const [inputGroupDescription, setInputGroupDescription] = useState<string | undefined>(
        isCreateMode ? '' : selectedGroup?.description || '',
    );
    const [selectedEmoji, setSelectedEmoji] = useState<string | undefined>(
        isCreateMode ? undefined : selectedGroup?.emoji || undefined,
    );
    const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);

    const onChangeGroupName = (event: React.ChangeEvent<HTMLInputElement>) => {
        setInputGroupName(event.target.value);
    };

    const onChangeGroupDescription = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInputGroupDescription(event.target.value);
    };

    const randomIcon = useMemo(() => {
        const randomIndex = Math.floor(Math.random() * GROUP_ICONS.length);
        return GROUP_ICONS[randomIndex];
    }, []);

    const onClickSave = () => {
        if (isCreateMode) {
            createGroup({
                groupName: inputGroupName,
                groupDescription: inputGroupDescription,
                groupEmoji: selectedEmoji,
            })
                .then(group => {
                    setIsModalOpened(false);
                    setInputGroupName('');
                    setInputGroupDescription('');
                    setSelectedEmoji(undefined);
                    toast.success(`Group "${group.name}" created successfully!`);
                })
                .catch(error => {
                    toast.error(`Something went wrong while creating the group.`);
                    console.error('Error creating group:', error);
                });
        } else {
            updateGroup({
                groupName: inputGroupName,
                groupDescription: inputGroupDescription,
                groupEmoji: selectedEmoji,
            })
                .then(updatedGroup => {
                    setIsModalOpened(false);
                    toast.success(`Group "${updatedGroup.name}" updated successfully!`);
                })
                .catch(error => {
                    toast.error(`Something went wrong while updating the group.`);
                    console.error('Error updating group:', error);
                });
        }
    };

    return (
        <BaseModal
            isOpened={isModalOpened}
            setIsOpened={setIsModalOpened}
            triggerElement={children}
            title={isCreateMode ? 'Create new group' : 'Edit group'}
            maxWidth="480px"
            content={
                <Flex direction="column" gap="6">
                    <label>
                        <Text as="div" size="3" mb="2">
                            Group name
                        </Text>

                        <TextField.Root
                            required
                            size="3"
                            variant="surface"
                            placeholder="Enter group name"
                            type="text"
                            autoFocus
                            value={inputGroupName}
                            onChange={onChangeGroupName}
                        />
                    </label>
                    <label>
                        <Text as="div" size="3" mb="2">
                            Group description (optional)
                        </Text>

                        <TextArea
                            size="3"
                            placeholder="Add a description to your group"
                            value={inputGroupDescription}
                            onChange={onChangeGroupDescription}
                        />
                    </label>

                    <Flex direction="column">
                        <Flex align="center" gap="4">
                            <IconButton
                                size="4"
                                variant={selectedEmoji ? 'surface' : 'outline'}
                                color={selectedEmoji ? 'blue' : 'gray'}
                                radius="large"
                                onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
                            >
                                <Text size="7">{selectedEmoji || randomIcon}</Text>
                            </IconButton>
                            <Text size="2" color="gray">
                                {selectedEmoji
                                    ? 'Nice choice!'
                                    : 'Select an emoji icon for your group'}
                            </Text>
                        </Flex>

                        {isEmojiPickerOpen && (
                            <Flex gap="2" mt="4" wrap="wrap" align="center" justify="center">
                                {GROUP_ICONS.map(icon => (
                                    <IconButton
                                        key={icon}
                                        size="2"
                                        variant={selectedEmoji === icon ? 'classic' : 'outline'}
                                        color={selectedEmoji === icon ? 'blue' : 'gray'}
                                        radius="large"
                                        onClick={() => {
                                            setSelectedEmoji(icon);
                                            setIsEmojiPickerOpen(false);
                                        }}
                                    >
                                        <Text size="6">{icon}</Text>
                                    </IconButton>
                                ))}
                            </Flex>
                        )}
                    </Flex>

                    <Flex justify="end" gap="4">
                        <Dialog.Close>
                            <Button size="3" variant="soft" color="gray">
                                {t('buttons.cancel')}
                            </Button>
                        </Dialog.Close>

                        <Button
                            size="3"
                            variant="solid"
                            disabled={!inputGroupName || isCreatingGroup || isUpdatingGroup}
                            loading={isCreatingGroup || isUpdatingGroup}
                            onClick={onClickSave}
                        >
                            {isCreateMode ? 'Create group' : 'Save group'}
                        </Button>
                    </Flex>
                </Flex>
            }
        />
    );
};

export default CreateUpdateGroupModal;
