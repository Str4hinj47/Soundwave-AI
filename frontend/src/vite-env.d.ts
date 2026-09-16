/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "1" only in the single-file standalone build (vite.config.standalone.ts). */
  readonly VITE_STANDALONE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
