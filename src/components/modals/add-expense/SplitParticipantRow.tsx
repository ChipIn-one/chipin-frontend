import { ReactNode } from 'react';
import { UserAvatar } from 'basics';
import { LucideCheck } from 'lucide-react';
import styled from 'styled-components';

import { Flex, Text } from '@radix-ui/themes';

import { themeColor } from 'helpers/colors';

import type { ExpenseParticipant } from './expenseParticipants';

const Row = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    min-height: 40px;
`;

const ParticipantButton = styled.button<{ $isIncluded: boolean; $isLocked: boolean }>`
    all: unset;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    flex: 1;
    cursor: ${({ $isLocked }) => ($isLocked ? 'default' : 'pointer')};
    color: ${({ $isIncluded }) => ($isIncluded ? themeColor('gray12') : themeColor('gray10'))};
`;

const CheckIndicator = styled.span<{ $isIncluded: boolean }>`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: var(--radius-3);
    border: 1px solid
        ${({ $isIncluded }) => ($isIncluded ? themeColor('jade8') : themeColor('gray7'))};
    background-color: ${({ $isIncluded }) =>
        $isIncluded ? themeColor('jade9') : themeColor('gray3')};
    color: ${themeColor('gray1')};
    flex-shrink: 0;
    transition:
        background-color 150ms ease,
        border-color 150ms ease,
        color 150ms ease;
`;

const CheckSpacer = styled.span`
    width: 20px;
    height: 20px;
    flex-shrink: 0;
`;

const Controls = styled.div<{ $isIncluded: boolean }>`
    flex-shrink: 0;
    opacity: ${({ $isIncluded }) => ($isIncluded ? 1 : 0.55)};
    transition: opacity 150ms ease;
`;

interface Props {
    member: ExpenseParticipant;
    isIncluded: boolean;
    isIncludeLocked?: boolean;
    includeLabel: string;
    onIncludedChange: (isIncluded: boolean) => void;
    children: ReactNode;
}

const SplitParticipantRow = ({
    member,
    isIncluded,
    isIncludeLocked = false,
    includeLabel,
    onIncludedChange,
    children,
}: Props) => {
    const handleToggle = () => {
        if (isIncludeLocked) {
            return;
        }

        onIncludedChange(!isIncluded);
    };

    return (
        <Row>
            <ParticipantButton
                type="button"
                $isIncluded={isIncluded}
                $isLocked={isIncludeLocked}
                aria-pressed={isIncludeLocked ? undefined : isIncluded}
                aria-label={isIncludeLocked ? member.displayName : includeLabel}
                onClick={handleToggle}
                disabled={isIncludeLocked}
            >
                {isIncludeLocked ? (
                    <CheckSpacer />
                ) : (
                    <CheckIndicator $isIncluded={isIncluded}>
                        {isIncluded ? <LucideCheck size={14} /> : null}
                    </CheckIndicator>
                )}
                <UserAvatar user={member} size="2" />
                <Text size="2" weight="medium" truncate>
                    {member.displayName}
                </Text>
            </ParticipantButton>
            <Controls $isIncluded={isIncluded}>
                <Flex align="center" gap="1">
                    {children}
                </Flex>
            </Controls>
        </Row>
    );
};

export default SplitParticipantRow;
