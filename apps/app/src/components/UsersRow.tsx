import { PROP_COLOR } from '@chipin/tokens/theme';
import { Avatar, Flex, Text } from '@radix-ui/themes';
import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { GroupUser } from 'api/chipin.types';

import styles from './UsersRow.module.css';

type StackStyle = CSSProperties & Record<'--_stack-order', number>;

// Flex paints items in order-modified order, so the reverse layout keeps both DOM and visual user order intact.
const AvatarWrapper = ({ $stackOrder, children }: { $stackOrder: number; children: ReactNode }) => {
    const stackStyle: StackStyle = { '--_stack-order': -$stackOrder };

    return (
        <div className={styles.avatar} style={stackStyle}>
            {children}
        </div>
    );
};

interface Props {
    members: GroupUser[];
    max?: number;
    size?: React.ComponentProps<typeof Avatar>['size'];
}

const UsersRow = ({ members, size = '1', max = 5 }: Props) => {
    const { t } = useTranslation('common');
    const visibleUsers = members.slice(0, max);
    const hiddenCount = members.length - max;

    return (
        <Flex align="center" direction="row-reverse" justify="end">
            {visibleUsers.map((user, index) => (
                <AvatarWrapper key={user.id} $stackOrder={index}>
                    <Avatar
                        mr="-1"
                        size={size}
                        radius="full"
                        src={user.picture || ''}
                        alt={user.displayName}
                        fallback={user.displayName?.charAt(0)}
                    />
                </AvatarWrapper>
            ))}

            {hiddenCount > 0 && (
                <AvatarWrapper $stackOrder={visibleUsers.length}>
                    {/* The root is the named image: the visible "+N" alone says nothing to a screen reader. */}
                    <Avatar
                        asChild
                        mr="-1"
                        size="1"
                        color={PROP_COLOR.neutral}
                        radius="full"
                        fallback={
                            <Text size="1" weight="bold" as="span">
                                {t('members.overflow', { count: hiddenCount })}
                            </Text>
                        }
                    >
                        <span
                            role="img"
                            aria-label={t('members.overflowLabel', { count: hiddenCount })}
                        />
                    </Avatar>
                </AvatarWrapper>
            )}
        </Flex>
    );
};

export { AvatarWrapper, UsersRow };
