/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEMO?: string;
  readonly VITE_DEMO_ROLE?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __VERSAO__: string | null;
