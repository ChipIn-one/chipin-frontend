import { useId, useState } from 'react';
import type { ChangeEvent, ComponentProps, FocusEvent, ReactNode } from 'react';

import { Flex, Text, TextArea as RadixTextArea } from '@radix-ui/themes';

type TextAreaRootProps = ComponentProps<typeof RadixTextArea>;

interface TextAreaValueState {
    value: string;
    isValid: boolean;
}

interface Props
    extends Omit<
        TextAreaRootProps,
        'aria-describedby' | 'aria-invalid' | 'defaultValue' | 'id' | 'onChange' | 'value'
    > {
    id?: string;
    label: ReactNode;
    description?: ReactNode;
    initialValue?: string;
    isRequired?: boolean;
    validationMessage?: ReactNode;
    onValueChange?: (state: TextAreaValueState) => void;
    onValueCommit?: (value: string) => void;
}

const TextArea = ({
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

    const onChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
        const nextValue = event.target.value;
        const isNextValueValid =
            (!isRequired || nextValue.trim().length > 0) &&
            (maxLength === undefined || nextValue.length <= maxLength);

        setValue(nextValue);
        onValueChange?.({ value: nextValue, isValid: isNextValueValid });
    };

    const onBlur = (event: FocusEvent<HTMLTextAreaElement>) => {
        setIsTouched(true);

        if (isValid) {
            onValueCommit?.(value);
        }

        onInputBlur?.(event);
    };

    return (
        <Flex direction="column" gap="2">
            <Flex justify="between" align="end" gap="3">
                <Flex gap="1" minWidth="0">
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

            <RadixTextArea
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

export { TextArea, type TextAreaValueState };
