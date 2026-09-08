import type { ComponentProps, ReactNode } from 'react';

import { Box, Grid } from '@radix-ui/themes';

interface Props {
    children: ReactNode;
    sidePanel: ReactNode;
    gap?: ComponentProps<typeof Grid>['gap'];
}

interface ColumnsProps extends Props {
    mainGridColumn: ComponentProps<typeof Box>['gridColumn'];
    sidePanelGridColumn: ComponentProps<typeof Box>['gridColumn'];
    desktopGridRow: ComponentProps<typeof Box>['gridRow'];
}

const Columns = ({
    children,
    sidePanel,
    gap = '6',
    mainGridColumn,
    sidePanelGridColumn,
    desktopGridRow,
}: ColumnsProps) => (
    <Grid columns="3" gap={gap}>
        <Box gridColumn={sidePanelGridColumn} gridRow={desktopGridRow}>
            {sidePanel}
        </Box>

        <Box gridColumn={mainGridColumn} gridRow={desktopGridRow}>
            {children}
        </Box>
    </Grid>
);

const InternalPageColumns = (props: Props) => (
    <Columns
        {...props}
        sidePanelGridColumn={{ initial: 'span 3', lg: '3' }}
        mainGridColumn={{ initial: 'span 3', lg: '1 / span 2' }}
        desktopGridRow={{ lg: '1' }}
    />
);

const InternalPageColumnsFromSm = (props: Props) => (
    <Columns
        {...props}
        sidePanelGridColumn={{ initial: 'span 3', sm: '3' }}
        mainGridColumn={{ initial: 'span 3', sm: '1 / span 2' }}
        desktopGridRow={{ sm: '1' }}
    />
);

export { InternalPageColumns, InternalPageColumnsFromSm };
