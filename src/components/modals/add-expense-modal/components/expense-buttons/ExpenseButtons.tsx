import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, Button, Flex, Text } from '@radix-ui/themes';

import { OverlayFooter } from '../../../components';
import { useExpenseModalSubmit } from '../../internal';

import { ExpenseSubmitFeedbackMessage, useConnect } from './internal';

interface Props {
    onClose: () => void;
}

const ExpenseButtons = ({ onClose }: Props) => {
    const { t } = useTranslation('group');
    const { mode, currency, feedback } = useConnect();
    const feedbackId = useId();
    const { isSubmitDisabled, isSubmitting, onSubmit } =
        useExpenseModalSubmit(onClose);

    return (
        <Flex direction="column" gap="2" minWidth="0" flexShrink="0">
            <Box px={{ initial: '4', sm: '0' }}>
                <Text
                    as="p"
                    id={feedbackId}
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                    size="2"
                    color="gray"
                    m="0"
                    wrap="pretty"
                >
                    {!isSubmitting && feedback && (
                        <ExpenseSubmitFeedbackMessage feedback={feedback} currency={currency} />
                    )}
                </Text>
            </Box>
            <OverlayFooter
                cancelAction={
                    <Button size="3" variant="soft" color="gray" onClick={onClose}>
                        {t('common:buttons.cancel')}
                    </Button>
                }
                primaryAction={
                    <Button
                        size="3"
                        variant="solid"
                        disabled={isSubmitDisabled || isSubmitting}
                        loading={isSubmitting}
                        aria-describedby={!isSubmitting && feedback ? feedbackId : undefined}
                        onClick={onSubmit}
                    >
                        {t(mode === 'edit' ? 'common:buttons.save' : 'common:buttons.addExpense')}
                    </Button>
                }
            />
        </Flex>
    );
};

export default ExpenseButtons;
