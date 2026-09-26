export interface CompanionBridge {
  isElectron: boolean;
  platform: string;
  versions?: { electron?: string; chrome?: string; node?: string };
  hide: () => void;
  toggle: () => void;
  quit: () => void;
  openExternal: (url: string) => void;
  onVisibility?: (cb: (visible: boolean) => void) => () => void;
}

declare global {
  interface Window {
    companion?: CompanionBridge;
  }
}

export {};
