import { TextField } from '@radix-ui/themes';
import styled from 'styled-components';

export const InputRoot = styled(TextField.Root)`
    width: 120px;
    flex: none;

    input {
        text-align: center;
        font-variant-numeric: tabular-nums;
    }
`;
