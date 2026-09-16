/** True only in the single-file standalone build (see vite.config.standalone.ts).
 *  In that build every /api/v1 call is served by standaloneApi.ts in-browser. */
export const STANDALONE: boolean = import.meta.env.VITE_STANDALONE === "1";
