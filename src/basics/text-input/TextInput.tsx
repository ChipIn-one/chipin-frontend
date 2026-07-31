import { useId, useState } from 'react';
import type { ChangeEvent, ComponentProps, FocusEvent, ReactNode } from 'react';

import { Flex, Text, TextField } from '@radix-ui/themes';

type TextFieldRootProps = ComponentProps<typeof TextField.Root>;

interface TextInputValueState {
    value: string;
    isValid: boolean;
}

interface Props
    extends Omit<
        TextFieldRootProps,
        'aria-describedby' | 'aria-invalid' | 'defaultValue' | 'id' | 'onChange' | 'value'
    > {
    id?: string;
    label: ReactNode;
    description?: ReactNode;
    initialValue?: string;
    isRequired?: boolean;
    validationMessage?: ReactNode;
    onValueChange?: (state: TextInputValueState) => void;
    onValueCommit?: (value: string) => void;
}

const TextInput = ({
    id,
    label,
    description,
    initialValue = '',
    isRequired = false,
    maxLength,
    validationMessage,
    onValueChange,
    onValueCommit,
    onBlur: onInputBlur,
    ...inputProps
}: Props) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const descriptionId = `${inputId}-description`;
    const [value, setValue] = useState(initialValue);
    const [isTouched, setIsTouched] = useState(false);
    const isValid =
        (!isRequired || value.trim().length > 0) &&
        (maxLength === undefined || value.length <= maxLength);
    const characterCounter =
        maxLength === undefined ? undefined : `${value.length} / ${maxLength}`;
    const isValidationMessageVisible = isTouched && !isValid && validationMessage !== undefined;

    const onChange = (event: ChangeEvent<HTMLInputElement>) => {
        const nextValue = event.target.value;
        const isNextValueValid =
            (!isRequired || nextValue.trim().length > 0) &&
            (maxLength === undefined || nextValue.length <= maxLength);

        setValue(nextValue);
        onValueChange?.({ value: nextValue, isValid: isNextValueValid });
    };

    const onBlur = (event: FocusEvent<HTMLInputElement>) => {
        setIsTouched(true);

        if (isValid) {
            onValueCommit?.(value);
        }

        onInputBlur?.(event);
    };

    return (
        <Flex direction="column" gap="2">
            <Flex justify="between" align="end" gap="3">
                <Flex direction="column" gap="1" minWidth="0">
                    <Text as="label" htmlFor={inputId} size="2" weight="medium">
                        {isValidationMessageVisible ? (
                            <Text as="span" color="red" role="alert">
                                {validationMessage}
                            </Text>
                        ) : (
                            label
                        )}
                    </Text>
                    {description && (
                        <Text id={descriptionId} size="2" color="gray">
                            {description}
                        </Text>
                    )}
                </Flex>

                {characterCounter && (
                    <Text size="1" color="gray" align="right" as="span">
                        {characterCounter}
                    </Text>
                )}
            </Flex>

            <TextField.Root
                {...inputProps}
                id={inputId}
                aria-describedby={description ? descriptionId : undefined}
                aria-invalid={!isValid}
                value={value}
                maxLength={maxLength}
                required={isRequired}
                onChange={onChange}
                onBlur={onBlur}
            />
        </Flex>
    );
};

export { TextInput, type TextInputValueState };
