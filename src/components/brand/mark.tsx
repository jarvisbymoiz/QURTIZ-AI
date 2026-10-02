import type { SVGProps } from "react";
import geometry from "@/lib/public/brand.json";

/** Three folded planes: independent workflows converging around shared context. */
export function QurtizMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" {...props}>
      <path fill="currentColor" d={geometry.path} />
    </svg>
  );
}
