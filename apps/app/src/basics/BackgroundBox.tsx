import { Box } from '@radix-ui/themes';

interface Props {
    children: React.ReactNode;
}

const BackgroundBox = ({ children }: Props) => {
    return <Box minHeight="100vh">{children}</Box>;
};

export default BackgroundBox;
