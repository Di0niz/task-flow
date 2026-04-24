import { X } from "lucide-react";
import { cn } from "../lib/utils";

const TAG_COLORS = [
  "bg-indigo-50 text-indigo-700",
  "bg-emerald-50 text-emerald-700",
  "bg-amber-50 text-amber-800",
  "bg-rose-50 text-rose-700",
  "bg-sky-50 text-sky-700",
  "bg-violet-50 text-violet-700",
];

function hashTag(tag: string) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) {
    h = (h * 31 + tag.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % TAG_COLORS.length;
}

export function TagChip({
  tag,
  onRemove,
  onClick,
  active,
  size = "sm",
}: {
  tag: string;
  onRemove?(): void;
  onClick?(): void;
  active?: boolean;
  size?: "sm" | "xs";
}) {
  const color = TAG_COLORS[hashTag(tag)];
  return (
    <span
      className={cn(
        "chip",
        color,
        onClick && "cursor-pointer hover:brightness-95",
        active && "ring-1 ring-current",
        size === "xs" && "text-[10px] px-1 py-[1px]",
      )}
      onClick={onClick}
    >
      <span className="opacity-80">#</span>
      <span>{tag}</span>
      {onRemove && (
        <button
          className="opacity-60 hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <X size={10} />
        </button>
      )}
    </span>
  );
}
