import 'styled-components';

type RadixColorScale = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12';
type RadixAlphaScale =
    | 'a1'
    | 'a2'
    | 'a3'
    | 'a4'
    | 'a5'
    | 'a6'
    | 'a7'
    | 'a8'
    | 'a9'
    | 'a10'
    | 'a11'
    | 'a12';
type RadixPaletteName =
    | 'amber'
    | 'blue'
    | 'bronze'
    | 'brown'
    | 'crimson'
    | 'cyan'
    | 'gold'
    | 'grass'
    | 'gray'
    | 'green'
    | 'indigo'
    | 'iris'
    | 'jade'
    | 'lime'
    | 'mauve'
    | 'mint'
    | 'olive'
    | 'orange'
    | 'pink'
    | 'plum'
    | 'purple'
    | 'red'
    | 'ruby'
    | 'sage'
    | 'sand'
    | 'sky'
    | 'slate'
    | 'teal'
    | 'tomato'
    | 'violet'
    | 'yellow';
type RadixColorToken = `${RadixPaletteName}${RadixColorScale | RadixAlphaScale}`;

declare module 'styled-components' {
    export interface DefaultTheme {
        colors: Partial<Record<RadixColorToken | 'white' | 'black', string>>;
    }
}
