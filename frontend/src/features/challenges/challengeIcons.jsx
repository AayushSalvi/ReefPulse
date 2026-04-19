/**
 * Minimal outline SVGs — thick stroke, round caps (Lucide-style).
 * Use currentColor so banner / surfaces control hue.
 */
const S = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.25,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

function Svg({ className, children, width = 26, height = 26 }) {
  return (
    <svg className={className} width={width} height={height} viewBox="0 0 24 24" aria-hidden>
      <g {...S}>{children}</g>
    </svg>
  );
}

export function ChallengeCardIcon({ name, className = "" }) {
  const cn = ["ch-icon", className].filter(Boolean).join(" ");
  switch (name) {
    case "shore-wave":
      return (
        <Svg className={cn}>
          <path d="M2 8c2.5 0 3.5-2 6-2s3.5 2 6 2 3.5-2 6-2 3.5 2 6 2" />
          <path d="M2 12c2.5 0 3.5-2 6-2s3.5 2 6 2 3.5-2 6-2 3.5 2 6 2" />
          <path d="M2 16c2.5 0 3.5-2 6-2s3.5 2 6 2 3.5-2 6-2 3.5 2 6 2" />
        </Svg>
      );
    case "fish-school":
      return (
        <Svg className={cn}>
          <path d="M4 12c3.5-4 10-4 14-1l3-2v6l-3-2c-4 3-10.5 3-14-1z" />
          <circle cx="7" cy="12" r="1.1" fill="currentColor" stroke="none" />
        </Svg>
      );
    case "quiet-observe":
      return (
        <Svg className={cn}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="9" cy="10" r="1" fill="currentColor" stroke="none" />
          <circle cx="15" cy="10" r="1" fill="currentColor" stroke="none" />
          <path d="M9 15.5a4 4 0 0 0 6 0" />
        </Svg>
      );
    case "ruler-viz":
      return (
        <Svg className={cn}>
          <path d="M4 20V4l16 16H4z" />
          <path d="M8 16V8M12 16v-5M16 16v-2" />
        </Svg>
      );
    case "camera-tide":
      return (
        <Svg className={cn}>
          <path d="M4 9h3l2-2h6l2 2h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z" />
          <circle cx="12" cy="14" r="3" />
        </Svg>
      );
    case "snorkel-buddy":
      return (
        <Svg className={cn}>
          <ellipse cx="9" cy="11" rx="4" ry="3.2" />
          <ellipse cx="17" cy="11" rx="4" ry="3.2" />
          <path d="M5 11v2M19 11v2M12 14v5" />
        </Svg>
      );
    default:
      return (
        <Svg className={cn}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v8M8 12h8" />
        </Svg>
      );
  }
}

export function TrophyTierIcon({ tierId, className = "" }) {
  const cn = ["ch-icon", "ch-icon--tier", className].filter(Boolean).join(" ");
  switch (tierId) {
    case "bronze":
      return (
        <Svg className={cn} width={28} height={28}>
          <circle cx="12" cy="9" r="5.5" />
          <path d="M8.5 14L7 21h10l-1.5-7" />
        </Svg>
      );
    case "silver":
      return (
        <Svg className={cn} width={28} height={28}>
          <circle cx="12" cy="8" r="4.5" />
          <path d="M7.5 12.5h9l1.2 7.5H6.3l1.2-7.5z" />
        </Svg>
      );
    case "gold":
      return (
        <Svg className={cn} width={28} height={28}>
          <path d="M12 2.5l2.2 4.5h4.8l-3.8 2.8 1.5 5.2L12 13.2 7.3 15l1.5-5.2L5 7h4.8L12 2.5z" />
        </Svg>
      );
    case "platinum":
      return (
        <Svg className={cn} width={28} height={28}>
          <path d="M12 2v3.5M12 18.5V22M4.2 4.2l2.5 2.5M17.3 17.3l2.5 2.5M2 12h3.5M18.5 12H22M4.2 19.8l2.5-2.5M17.3 6.7l2.5-2.5" />
          <circle cx="12" cy="12" r="2.8" />
        </Svg>
      );
    default:
      return <ChallengeCardIcon name="default" className={className} />;
  }
}
