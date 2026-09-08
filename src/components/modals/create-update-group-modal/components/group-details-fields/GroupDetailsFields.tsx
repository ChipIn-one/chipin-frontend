import { useState } from 'react';
import { TextArea, TextInput } from 'basics';
import { LucideChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, Flex } from '@radix-ui/themes';

import { DescriptionToggleButton, DescriptionToggleIcon } from './styled';

const DESCRIPTION_FIELD_ID = 'group-description-field';

interface Props {
    coverPicker?: ReactNode;
    description: string;
    isDescriptionCollapsible?: boolean;
    isSaving: boolean;
    name: string;
    onDescriptionChange: (description: string) => void;
    onNameChange: (name: string) => void;
}

const GroupDetailsFields = ({
    coverPicker,
    description,
    isDescriptionCollapsible = false,
    isSaving,
    name,
    onDescriptionChange,
    onNameChange,
}: Props) => {
    const { t } = useTranslation('group');
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    const isDescriptionVisible = !isDescriptionCollapsible || isDescriptionExpanded;

    return (
        <>
            <Flex align="end" gap="3">
                {coverPicker}
                <Box flexGrow="1" minWidth="0">
                    <TextInput
                        label={t('common:fields.groupName')}
                        initialValue={name}
                        maxLength={50}
                        isRequired
                        size="3"
                        radius="large"
                        placeholder={t('modal.fields.namePlaceholder')}
                        type="text"
                        disabled={isSaving}
                        onValueChange={({ value }) => onNameChange(value)}
                    />
                </Box>
            </Flex>

            <Flex direction="column" gap="2">
                {isDescriptionCollapsible && (
                    <DescriptionToggleButton
                        type="button"
                        size="2"
                        variant="outline"
                        color="gray"
                        disabled={isSaving}
                        aria-expanded={isDescriptionExpanded}
                        aria-controls={DESCRIPTION_FIELD_ID}
                        onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                    >
                        <DescriptionToggleIcon $isExpanded={isDescriptionExpanded}>
                            <LucideChevronDown size={16} aria-hidden />
                        </DescriptionToggleIcon>
                        {t('modal.fields.addDescription')}
                    </DescriptionToggleButton>
                )}

                {isDescriptionVisible && (
                    <Box id={DESCRIPTION_FIELD_ID}>
                        <TextArea
                            label={t('common:fields.description')}
                            description={t('modal.fields.descriptionOptional')}
                            initialValue={description}
                            size="3"
                            radius="large"
                            maxLength={160}
                            placeholder={t('modal.fields.descriptionPlaceholder')}
                            disabled={isSaving}
                            onValueChange={({ value }) => onDescriptionChange(value)}
                        />
                    </Box>
                )}
            </Flex>
        </>
    );
};

export default GroupDetailsFields;
