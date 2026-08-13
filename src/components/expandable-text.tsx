import { useEffect, useRef, useState } from "react";
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
          className="mt-1 text-sm font-medium text-primary underline-offset-2 hover:underline"
        >
          {expanded ? lessLabel : `… ${moreLabel}`}
        </button>
      )}
    </div>
  );
}
