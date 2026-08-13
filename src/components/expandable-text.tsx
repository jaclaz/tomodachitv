import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ExpandableTextProps {
  text: string;
  /** Number of lines shown when collapsed */
  lines?: number;
  className?: string;
  moreLabel?: string;
  lessLabel?: string;
}

export function ExpandableText({
  text,
  lines = 5,
  className,
  moreLabel = "more",
  lessLabel = "less",
}: ExpandableTextProps) {
  const ref = useRef<HTMLParagraphElement>(null);
  const contentId = useId();
  const [expanded, setExpanded] = useState(false);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setTruncated(el.scrollHeight - el.clientHeight > 2);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, lines]);

  return (
    <div className={cn("max-w-2xl", className)}>
      <p
        ref={ref}
        id={contentId}
        className="whitespace-pre-line"
        style={
          expanded
            ? undefined
            : {
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: lines,
                overflow: "hidden",
              }
        }
      >
        {text}
      </p>
      {(truncated || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls={contentId}
          className="mt-1 rounded-sm text-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span aria-hidden="true">{expanded ? lessLabel : `… ${moreLabel}`}</span>
          <span className="sr-only">
            {expanded ? "Show less description" : "Show full description"}
          </span>
        </button>
      )}
    </div>
  );
}
