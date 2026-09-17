// ── Shared domain types (client) ────────────────────────────────────────────

export type ModelStatus =
  | "not_loaded"
  | "downloading"
  | "loading"
  | "ready"
  | "error";

export type BackendKind = "edge" | "demo";

export type GenerationStatus =
  | "idle"
  | "downloading"
  | "loading"
  | "generating"
  | "streaming"
  | "done"
  | "cancelled"
  | "error";

export type Gender = "Female" | "Male";
export type Accent = "American" | "British";

export interface VoiceInfo {
  id: string;
  displayName: string;
  gender: Gender;
  accent: Accent;
  sampleUrl: string;
}

export interface VoiceSettings {
  speed: number; // 0.5 .. 2.0
  pitch: number; // -50 .. +50 (%)
  volume: number; // 0 .. 100 (%)
}

export interface WordTiming {
  word: string;
  start: number;
  end: number;
}

export interface SubtitleCue {
  id: string;
  start: number;
  end: number;
  text: string;
}

export type HAlign = "left" | "center" | "right";
export type VAlign = "top" | "middle" | "bottom";
export type SubtitleAnimation =
  | "none"
  | "fade"
  | "slideUp"
  | "slideDown"
  | "slideLeft"
  | "slideRight"
  | "scale"
  | "typewriter"
  | "wordByWord";

export interface SubtitleStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  letterSpacing: number;
  lineHeight: number;
  color: string;
  textOpacity: number; // 0..100
  bgColor: string;
  bgOpacity: number; // 0..100
  bgPadding: number; // 0..40
  bgRadius: number; // 0..20
  strokeEnabled: boolean;
  strokeColor: string;
  strokeWidth: number; // 0..10
  shadowEnabled: boolean;
  shadowColor: string;
  shadowBlur: number; // 0..20
  shadowX: number; // -20..20
  shadowY: number; // -20..20
  hAlign: HAlign;
  vAlign: VAlign;
  customX: number | null; // % from left (null = use hAlign)
  customY: number | null; // % from top (null = use vAlign)
  margin: number; // 0..100
  animIn: SubtitleAnimation;
  animOut: SubtitleAnimation;
  animDuration: number; // ms
}

export type ProjectType = "TTS" | "SUBTITLE" | "VIDEO";
export type ProjectStatus = "DRAFT" | "PROCESSING" | "COMPLETED" | "FAILED";
export type StorageType = "LOCAL" | "CLOUD";

export interface ProjectMeta {
  id: string;
  title: string;
  type: ProjectType;
  textContent: string;
  voiceId: string;
  voiceSettings: VoiceSettings;
  characterCount: number;
  duration: number | null;
  status: ProjectStatus;
  storageType: StorageType;
  createdAt: string;
  updatedAt: string;
  audioUrl?: string | null;
  videoBackgroundUrl?: string | null;
  exportedVideoUrl?: string | null;
  subtitleData?: SubtitleCue[] | null;
  subtitleStyle?: Partial<SubtitleStyle> | null;
}

export type Plan = "FREE" | "PRO" | "ENTERPRISE";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  plan: Plan;
  avatarUrl: string | null;
  emailVerified: boolean;
  /** Present and true in the simple single-user edition (SINGLE_USER_MODE). */
  singleUser?: boolean;
}

export interface QuotaStatus {
  used: number;
  limit: number;
  resetDate: string;
  plan: Plan;
  allowed: boolean;
}

export interface GenerationRecord {
  id: string;
  text: string;
  voiceId: string;
  createdAt: number;
  duration: number;
}

export type ToastType = "success" | "error" | "warning" | "info";
export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  persistent?: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  requestId?: string;
  retryAfter?: number;
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  key?: string;
  lastUsedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
}
