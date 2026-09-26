import type { Card, Mood } from "./types";

export interface BrainResult {
  handled: boolean;
  text: string;
  cards?: Card[];
  mood?: Mood;
  tag?: string;
  /** local brain recognized a creator/heavier intent → route to cloud brain */
  needsCloud?: boolean;
  /** URL the shell should open externally (Electron) */
  openUrl?: string;
  /** navigate the panel to a tab */
  goto?: string;
}
