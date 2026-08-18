import { useId } from "react";
import { cn } from "@/lib/utils";

export type PopcornFill = "empty" | "half" | "full";

interface OnigiriIconProps {
  fill?: PopcornFill;
  className?: string;
}

const PATH_BODY = "M20 15c6 0 12 9 13 14 1 4-5 6-13 6S6 33 7 29c1-5 7-14 13-14Z";
const PATH_NORI = "M11 27h13v3c0 3-3 4-6 4s-7-1-7-4v-3Z";

/** Onigiri mark used for personal user scores (distinct from TMDB stars). */
export function PopcornIcon({ fill = "empty", className }: OnigiriIconProps) {
  const id = useId();
  const clipId = `onigiri-clip-${id}`;

  return (
    <svg
      viewBox="4 13 32 27"
      aria-hidden="true"
      focusable="false"
      className={cn("h-5 w-5", className)}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width={fill === "half" ? 20 : 40} height="40" />
        </clipPath>
      </defs>

      {fill !== "empty" && (
        <g clipPath={`url(#${clipId})`} fill="currentColor">
          <path d={PATH_BODY} opacity="0.9" />
          <path d={PATH_NORI} opacity="0.55" />
          <circle cx="7" cy="37" r="1.8" />
          <circle cx="33" cy="36" r="1.4" />
        </g>
      )}

      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={PATH_BODY} />
        <path d={PATH_NORI} />
      </g>
    </svg>
  );
}

export { PopcornIcon as OnigiriIcon };
