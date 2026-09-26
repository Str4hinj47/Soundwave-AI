import type { Mood } from "../lib/types";

/**
 * Echo — Soundwave's little buddy face.
 * A warm squircle with a waveform tuft, blinking eyes and moods
 * that react to what the agent is doing (idle, thinking, listening,
 * talking, happy, focused).
 */
export function BuddyFace({
  size = 96,
  mood = "idle",
  className = "",
}: {
  size?: number;
  mood?: Mood;
  className?: string;
}) {
  const moodClass = `face face-${mood} ${mood === "happy" ? "" : mood === "idle" ? "face-idle" : ""}`;

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={`${moodClass} ${className}`}
      aria-label={`Echo is ${mood}`}
      role="img"
    >
      <defs>
        <linearGradient id="faceSkin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F2D2AB" />
          <stop offset="100%" stopColor="#DFAF7D" />
        </linearGradient>
        <linearGradient id="faceShade" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="cheek" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#E97A5A" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#E97A5A" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* squircle body */}
      <rect x="5" y="5" width="110" height="110" rx="36" fill="url(#faceSkin)" />
      <rect x="5" y="5" width="110" height="110" rx="36" fill="url(#faceShade)" />
      <rect
        x="5"
        y="5"
        width="110"
        height="110"
        rx="36"
        fill="none"
        stroke="rgba(120, 78, 40, 0.28)"
        strokeWidth="2"
      />

      {/* waveform tuft — the Soundwave mark */}
      <g fill="#8A5A30" opacity="0.85">
        <rect x="52" y="24" width="4" height="10" rx="2">
          {mood === "talking" && <animate attributeName="height" values="8;14;8" dur="0.5s" repeatCount="indefinite" />}
        </rect>
        <rect x="58" y="20" width="4" height="18" rx="2">
          {mood === "talking" && <animate attributeName="height" values="16;8;16" dur="0.45s" repeatCount="indefinite" />}
        </rect>
        <rect x="64" y="24" width="4" height="10" rx="2">
          {mood === "talking" && <animate attributeName="height" values="9;13;9" dur="0.55s" repeatCount="indefinite" />}
        </rect>
      </g>

      {/* blush */}
      <ellipse cx="34" cy="76" rx="9" ry="5.5" fill="url(#cheek)" />
      <ellipse cx="86" cy="76" rx="9" ry="5.5" fill="url(#cheek)" />

      {/* eyes */}
      {mood === "happy" ? (
        <g className="eyes" stroke="#33261A" strokeWidth="5" strokeLinecap="round" fill="none">
          <path d="M34 56 q8 -9 16 0" />
          <path d="M70 56 q8 -9 16 0" />
        </g>
      ) : mood === "focused" ? (
        <g className="eyes" fill="#33261A">
          <g className="pupils">
            <rect x="34" y="47" width="16" height="9" rx="4.5" />
            <rect x="70" y="47" width="16" height="9" rx="4.5" />
          </g>
          <path d="M32 42 l18 5" stroke="#33261A" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M88 42 l-18 5" stroke="#33261A" strokeWidth="3.5" strokeLinecap="round" />
        </g>
      ) : (
        <g className="eyes" fill="#33261A">
          <g className="pupils">
            <ellipse cx="42" cy="53" rx={mood === "listening" ? 8 : 7} ry={mood === "listening" ? 11 : 9.5} />
            <ellipse cx="78" cy="53" rx={mood === "listening" ? 8 : 7} ry={mood === "listening" ? 11 : 9.5} />
            <circle cx="44.5" cy="49.5" r="2.2" fill="#ffffff" opacity="0.9" />
            <circle cx="80.5" cy="49.5" r="2.2" fill="#ffffff" opacity="0.9" />
          </g>
        </g>
      )}

      {/* listening halo */}
      {mood === "listening" && (
        <g className="ring-pulse" style={{ transformOrigin: "60px 53px" }}>
          <ellipse cx="42" cy="53" rx="14" ry="16" fill="none" stroke="var(--accent)" strokeWidth="2.5" />
          <ellipse cx="78" cy="53" rx="14" ry="16" fill="none" stroke="var(--accent)" strokeWidth="2.5" />
        </g>
      )}

      {/* mouth */}
      {mood === "talking" ? (
        <g fill="#33261A">
          <rect className="talk-bar" style={{ animationDelay: "0ms" }} x="50" y="76" width="5" height="14" rx="2.5" />
          <rect className="talk-bar" style={{ animationDelay: "140ms" }} x="57.5" y="73" width="5" height="20" rx="2.5" />
          <rect className="talk-bar" style={{ animationDelay: "70ms" }} x="65" y="76" width="5" height="14" rx="2.5" />
        </g>
      ) : mood === "listening" ? (
        <ellipse cx="60" cy="84" rx="7" ry="8" fill="#33261A" />
      ) : mood === "happy" ? (
        <path d="M46 78 q14 16 28 0" stroke="#33261A" strokeWidth="5" strokeLinecap="round" fill="none" />
      ) : mood === "focused" ? (
        <path d="M50 84 h20" stroke="#33261A" strokeWidth="5" strokeLinecap="round" />
      ) : mood === "thinking" ? (
        <g>
          <ellipse cx="63" cy="83" rx="6" ry="5" fill="#33261A" />
        </g>
      ) : (
        <path d="M50 80 q10 9 20 0" stroke="#33261A" strokeWidth="5" strokeLinecap="round" fill="none" />
      )}
    </svg>
  );
}
