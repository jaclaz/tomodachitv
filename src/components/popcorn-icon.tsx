import { useId } from "react";
import { cn } from "@/lib/utils";

export type PopcornFill = "empty" | "half" | "full";

interface PopcornIconProps {
  fill?: PopcornFill;
  className?: string;
}

const PATH_BOX = "M6.2 10h11.6l-1.15 10.2A2 2 0 0 1 14.66 22H9.34a2 2 0 0 1-1.99-1.8L6.2 10Z";
const PATH_STRIPES = "M10.2 10.6 9.3 21.6M13.8 10.6l.9 11";
const PATH_CORN =
  "M7.1 10a2.1 2.1 0 0 1-.2-4.2 2.4 2.4 0 0 1 3.2-2.5 2.3 2.3 0 0 1 3.8 0 2.4 2.4 0 0 1 3.2 2.5 2.1 2.1 0 0 1-.2 4.2";

/** Popcorn tub used for personal user scores (distinct from TMDB stars). */
export function PopcornIcon({ fill = "empty", className }: PopcornIconProps) {
  const id = useId();
  const clipId = `popcorn-clip-${id}`;

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={cn("h-5 w-5", className)}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width={fill === "half" ? 12 : 24} height="24" />
        </clipPath>
      </defs>

      {fill !== "empty" && (
        <g clipPath={`url(#${clipId})`}>
          <path d={PATH_BOX} fill="currentColor" opacity="0.9" />
          <path d={PATH_CORN} fill="currentColor" opacity="0.55" />
        </g>
      )}

      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={PATH_BOX} />
        <path d={PATH_STRIPES} />
        <path d={PATH_CORN} />
      </g>
    </svg>
  );
}
