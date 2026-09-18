export type Plan = "FREE" | "PRO" | "ENTERPRISE";

export interface PlanDefinition {
  id: Plan;
  name: string;
  monthlyPrice: number; // USD
  annualPricePerMonth: number;
  characterLimit: number;
  maxVideoMb: number;
  exportsPerHour: number;
  maxResolution: "720p" | "1080p" | "4K";
  watermark: boolean;
  cloudSave: boolean;
  maxProjects: number;
  subtitleFonts: 3 | 20;
  fullStyling: boolean;
  apiAccess: boolean;
}

export const PLANS: Record<Plan, PlanDefinition> = {
  FREE: {
    id: "FREE",
    name: "Enterprise",
    monthlyPrice: 0,
    annualPricePerMonth: 0,
    characterLimit: 2_000_000,
    maxVideoMb: 2048,
    exportsPerHour: 1000,
    maxResolution: "4K",
    watermark: false,
    cloudSave: true,
    maxProjects: Infinity,
    subtitleFonts: 20,
    fullStyling: true,
    apiAccess: true,
  },
  PRO: {
    id: "PRO",
    name: "Enterprise",
    monthlyPrice: 0,
    annualPricePerMonth: 0,
    characterLimit: 2_000_000,
    maxVideoMb: 2048,
    exportsPerHour: 1000,
    maxResolution: "4K",
    watermark: false,
    cloudSave: true,
    maxProjects: Infinity,
    subtitleFonts: 20,
    fullStyling: true,
    apiAccess: true,
  },
  ENTERPRISE: {
    id: "ENTERPRISE",
    name: "Enterprise",
    monthlyPrice: 0,
    annualPricePerMonth: 0,
    characterLimit: 2_000_000,
    maxVideoMb: 2048,
    exportsPerHour: 1000,
    maxResolution: "4K",
    watermark: false,
    cloudSave: true,
    maxProjects: Infinity,
    subtitleFonts: 20,
    fullStyling: true,
    apiAccess: true,
  },
};

export function getPlan(plan: Plan): PlanDefinition {
  // NO LIMITS — always Enterprise, no watermark, unlimited
  return PLANS.ENTERPRISE;
}

export const RESOLUTIONS = {
  "720p": { width: 1280, height: 720 },
  "1080p": { width: 1920, height: 1080 },
  "1440p": { width: 2560, height: 1440 },
  "4K": { width: 3840, height: 2160 },
} as const;

export type ResolutionKey = keyof typeof RESOLUTIONS;
export type AspectRatio = "16:9" | "9:16";

export function dimensionsFor(res: ResolutionKey, aspect: AspectRatio = "16:9"): { width: number; height: number } {
  const { width, height } = RESOLUTIONS[res];
  return aspect === "9:16" ? { width: height, height: width } : { width, height };
}

export function resolutionAllowed(plan: Plan, res: ResolutionKey): boolean {
  // NO LIMITS — all resolutions allowed
  return true;
}

export function nextMonthlyReset(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0);
}
