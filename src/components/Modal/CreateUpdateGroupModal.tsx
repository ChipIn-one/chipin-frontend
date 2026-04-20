import { useEffect, useMemo, useState } from 'react';
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
import { useGroupsStore } from 'store/groupsStore';
import { useLoadingStore } from 'store/loadingStore';

import BaseModal from './BaseModal';

interface Props {
    children: React.ReactNode;
    type: 'create' | 'update';
}

const GROUP_DESCRIPTION_MAX_LENGTH = 160;

type GroupIconCategoryKey = 'travel' | 'food' | 'home' | 'fun' | 'work';

const GROUP_ICON_CATEGORIES: ReadonlyArray<{
    key: GroupIconCategoryKey;
    labelKey: string;
    icons: readonly string[];
}> = [
    {
        key: 'travel',
        labelKey: 'modal.categories.travel',
        icons: ['✈️', '🧳', '🏖️', '⛰️', '🗺️', '🌍', '🏕️', '🛳️', '🚂', '🏨', '🚢', '🚁'],
    },
    {
        key: 'food',
        labelKey: 'modal.categories.food',
        icons: ['🍽️', '🍕', '🍺', '☕', '🥂', '🛒', '🍣', '🍜', '🎂', '🥗', '🍷', '🍔'],
    },
    {
        key: 'home',
        labelKey: 'modal.categories.home',
        icons: ['🏠', '🏡', '⚡', '🌿', '📦', '💡', '🔧', '🛏️', '📱', '🖥️', '🐶', '🌱'],
    },
    {
        key: 'fun',
        labelKey: 'modal.categories.fun',
        icons: ['🎮', '🎬', '🎵', '⚽', '🎯', '🎪', '🎭', '🎡', '🏋️', '🎨', '🎤', '🎉'],
    },
    {
        key: 'work',
        labelKey: 'modal.categories.work',
        icons: ['💼', '📊', '💰', '⚖️', '🏦', '🔗', '🧩', '🚀', '🪙', '📋', '💸', '🎓'],
    },
];

const DEFAULT_CATEGORY_KEY: GroupIconCategoryKey = 'travel';
const ALL_GROUP_ICONS = GROUP_ICON_CATEGORIES.flatMap(category => category.icons);

const FieldLabel = styled(Text)`
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: ${themeColor('gray11')};
`;

const CategoriesRow = styled(Flex)`
    width: max-content;
    min-width: 100%;
`;

const CategoryButton = styled(Button)`
    flex-shrink: 0;
`;

const IconPanel = styled(Box)`
    border: 1px solid ${themeColor('gray6')};
    border-radius: var(--radius-5);
    background-color: ${themeColor('gray2')};
`;

const IconsGrid = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    width: 100%;
`;

const EmojiChoiceButton = styled(IconButton)<{ $selected: boolean }>`
    flex: 0 0 calc((100% - (var(--space-2) * 5)) / 6);
    min-width: calc((100% - (var(--space-2) * 5)) / 6);
    max-width: calc((100% - (var(--space-2) * 5)) / 6);
    height: var(--space-9);
    padding: 0;
    box-sizing: border-box;
    border: 1px solid ${({ $selected, theme }) => ($selected ? theme.colors.jade8 : 'transparent')};
    background-color: ${({ $selected, theme }) => ($selected ? theme.colors.jade3 : 'transparent')};
`;

const PreviewIconBox = styled(Flex)`
    flex-shrink: 0;
    width: var(--space-9);
    height: var(--space-9);
    border: 1px solid ${themeColor('jade7')};
    border-radius: var(--radius-5);
    background-color: ${themeColor('jade3')};
`;

const GroupNameField = styled(TextField.Root)`
    width: 100%;
    min-height: var(--space-9);
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

const CreateUpdateGroupModal = ({ children, type }: Props) => {
    const { t } = useTranslation('group');
    const { createGroup, updateGroup, selectedGroup } = useGroupsStore();
    const isCreatingGroup = useLoadingStore(state => state.group.add);
    const isUpdatingGroup = useLoadingStore(state => state.group.update);
    const isCreateMode = type === 'create';

    const randomIcon = useMemo(() => {
        const randomIndex = Math.floor(Math.random() * ALL_GROUP_ICONS.length);
        return ALL_GROUP_ICONS[randomIndex] ?? '👥';
    }, []);

    const [isModalOpened, setIsModalOpened] = useState(false);
    const [inputGroupName, setInputGroupName] = useState('');
    const [inputGroupDescription, setInputGroupDescription] = useState('');
    const [selectedEmoji, setSelectedEmoji] = useState(randomIcon);
    const [selectedCategory, setSelectedCategory] =
        useState<GroupIconCategoryKey>(DEFAULT_CATEGORY_KEY);

    useEffect(() => {
        const nextName = isCreateMode ? '' : (selectedGroup?.name ?? '');
        const nextDescription = isCreateMode ? '' : (selectedGroup?.description ?? '');
        const nextEmoji = isCreateMode ? randomIcon : (selectedGroup?.emoji ?? randomIcon);

        setInputGroupName(nextName);
        setInputGroupDescription(nextDescription);
        setSelectedEmoji(nextEmoji);
        setSelectedCategory(resolveCategoryFromEmoji(nextEmoji));
    }, [
        isCreateMode,
        isModalOpened,
        randomIcon,
        selectedGroup?.description,
        selectedGroup?.emoji,
        selectedGroup?.name,
    ]);

    const selectedCategoryIcons = useMemo(
        () =>
            GROUP_ICON_CATEGORIES.find(category => category.key === selectedCategory)?.icons ??
            ALL_GROUP_ICONS,
        [selectedCategory],
    );

    const onSelectCategory = (categoryKey: GroupIconCategoryKey) => {
        setSelectedCategory(categoryKey);

        const nextCategory = GROUP_ICON_CATEGORIES.find(category => category.key === categoryKey);

        if (nextCategory && !nextCategory.icons.includes(selectedEmoji)) {
            setSelectedEmoji(nextCategory.icons[0]);
        }
    };

    const onClickSave = () => {
        const normalizedGroupName = inputGroupName.trim();
        const normalizedDescription = inputGroupDescription.trim();

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
                    setIsModalOpened(false);
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
                    setIsModalOpened(false);
                    toast.success(t('toasts:group.updated', { name: updatedGroup.name }));
                })
                .catch(error => {
                    toast.error(t('toasts:group.updateError'));
                    console.error('Error updating group:', error);
                });
        }
    };

    return (
        <BaseModal
            isOpened={isModalOpened}
            setIsOpened={setIsModalOpened}
            triggerElement={children}
            title={isCreateMode ? t('modal.titleCreate') : t('modal.titleEdit')}
            maxWidth="480px"
            content={
                <Flex direction="column" gap="5">
                    <Flex direction="column" gap="2">
                        <FieldLabel as="div" size="2" weight="medium">
                            {t('modal.fields.nameLabel')}
                        </FieldLabel>

                        <Flex align="stretch" gap="3" width="100%">
                            <PreviewIconBox align="center" justify="center">
                                <Text size="7">{selectedEmoji}</Text>
                            </PreviewIconBox>

                            <Box width="100%">
                                <GroupNameField
                                    required
                                    autoFocus
                                    size="3"
                                    radius="large"
                                    variant="surface"
                                    placeholder={t('modal.fields.namePlaceholder')}
                                    type="text"
                                    value={inputGroupName}
                                    onChange={e => setInputGroupName(e.target.value)}
                                />
                            </Box>
                        </Flex>
                    </Flex>

                    <Flex direction="column" gap="2">
                        <Flex align="center" justify="between" gap="3">
                            <Flex align="center" gap="2">
                                <FieldLabel as="div" size="2" weight="medium">
                                    {t('modal.fields.descriptionLabel')}
                                </FieldLabel>
                                <Text size="2" color="gray">
                                    {t('modal.fields.descriptionOptional')}
                                </Text>
                            </Flex>

                            <Text size="2" color="gray">
                                {inputGroupDescription.length}/{GROUP_DESCRIPTION_MAX_LENGTH}
                            </Text>
                        </Flex>

                        <TextArea
                            size="3"
                            radius="large"
                            maxLength={GROUP_DESCRIPTION_MAX_LENGTH}
                            placeholder={t('modal.fields.descriptionPlaceholder')}
                            value={inputGroupDescription}
                            onChange={e => setInputGroupDescription(e.target.value)}
                        />
                    </Flex>

                    <Flex direction="column" gap="3">
                        <Flex align="center" justify="between" gap="3">
                            <FieldLabel as="div" size="2" weight="medium">
                                {t('modal.fields.iconLabel')}
                            </FieldLabel>

                            <Text size="3" color="gray">
                                {t('modal.fields.selectedIcon', { icon: selectedEmoji })}
                            </Text>
                        </Flex>

                        <ScrollArea scrollbars="horizontal">
                            <CategoriesRow gap="2" pr="1">
                                {GROUP_ICON_CATEGORIES.map(category => (
                                    <CategoryButton
                                        key={category.key}
                                        type="button"
                                        size="2"
                                        radius="full"
                                        variant={
                                            selectedCategory === category.key ? 'solid' : 'surface'
                                        }
                                        color={selectedCategory === category.key ? 'jade' : 'gray'}
                                        onClick={() => onSelectCategory(category.key)}
                                    >
                                        {t(category.labelKey)}
                                    </CategoryButton>
                                ))}
                            </CategoriesRow>
                        </ScrollArea>

                        <IconPanel p="2">
                            <IconsGrid>
                                {selectedCategoryIcons.map(icon => (
                                    <EmojiChoiceButton
                                        key={`${selectedCategory}-${icon}`}
                                        type="button"
                                        size="4"
                                        radius="large"
                                        variant={selectedEmoji === icon ? 'surface' : 'ghost'}
                                        color={selectedEmoji === icon ? 'jade' : 'gray'}
                                        $selected={selectedEmoji === icon}
                                        onClick={() => setSelectedEmoji(icon)}
                                    >
                                        <Text size="6">{icon}</Text>
                                    </EmojiChoiceButton>
                                ))}
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
                            disabled={!inputGroupName.trim() || isCreatingGroup || isUpdatingGroup}
                            loading={isCreatingGroup || isUpdatingGroup}
                            onClick={onClickSave}
                        >
                            {isCreateMode ? t('modal.actions.create') : t('modal.actions.save')}
                        </Button>
                    </Flex>
                </Flex>
            }
        />
    );
};

export default CreateUpdateGroupModal;
