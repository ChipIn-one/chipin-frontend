import { LucideCirclePlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

import { Box, Button } from '@radix-ui/themes';

const StickyBox = styled(Box)`
    position: sticky;
    top: 0;
    right: 0;
    width: 100%;
    z-index: 1;
`;

const AddExpenseButton = () => {
    return (
        <StickyBox>
            <Link to="#">
                <Button variant="classic" size="3" radius="full">
                    <LucideCirclePlus />
                    Add expense
                </Button>
            </Link>
        </StickyBox>
    );
};

export default AddExpenseButton;
