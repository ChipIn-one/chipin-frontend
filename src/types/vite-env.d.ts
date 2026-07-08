/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
/// <reference types="vite-plugin-svgr/client" />

type ViteChipInEnv = 'dev' | 'prod';

interface ImportMetaEnv {
    readonly VITE_CHIPIN_ENV?: ViteChipInEnv;
}
