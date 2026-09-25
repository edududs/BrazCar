interface AvatarProps {
  readonly name: string;
  readonly size?: 28 | 48 | 72;
}

/** The first letters of the first and last names. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.charAt(0) ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? "") : "";
  return (first + last).toUpperCase();
}

const sizes = {
  28: "size-7 text-[11px] font-extrabold tracking-[0.02em] bg-surface-2 text-ink-2",
  48: "size-12 font-display text-body font-extrabold bg-brand-soft text-brand-ink",
  72: "size-[72px] font-display text-heading font-extrabold bg-brand-soft text-brand-ink",
} as const;

/** A person as their initials on a disc: no photos on the platform. */
export function Avatar({ name, size = 28 }: AvatarProps) {
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center rounded-full ${sizes[size]}`}>
      {initialsOf(name)}
    </span>
  );
}
