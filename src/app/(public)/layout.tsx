import { PublicNavbar, PublicFooter } from "@/components/public/shell";
import { MotionSurface } from "@/components/public/motion-surface";
import "./public.css";
import "./enhancements.css";
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MotionSurface>
      <a className="public-skip" href="#public-main">
        Skip to content
      </a>
      <PublicNavbar />
      <main id="public-main">{children}</main>
      <PublicFooter />
    </MotionSurface>
  );
}
