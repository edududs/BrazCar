import type { ReactNode } from "react";

import { inlineLinkClass } from "./link-class";

interface ExternalLinkProps {
  readonly href: string;
  readonly children: ReactNode;
}

/** A link that leaves the app, in a new tab, in the inline link's own look. */
export function ExternalLink({ href, children }: ExternalLinkProps) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={inlineLinkClass}>
      {children}
    </a>
  );
}
