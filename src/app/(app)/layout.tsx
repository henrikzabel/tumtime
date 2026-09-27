import { SiteFooter } from "@/components/site-footer";
import { SiteHeader, SiteSidebar, UnofficialBanner } from "@/components/site-header";

// EXPERIMENT: cal.com app shell. On large screens the page is a gray canvas with a borderless sidebar and the
// content in a rounded white panel that scrolls on its own; smaller screens keep the classic top bar.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh lg:flex-row lg:bg-shell">
      <SiteSidebar />
      <div className="flex min-w-0 flex-1 flex-col lg:my-2 lg:mr-2 lg:overflow-y-auto lg:rounded-2xl lg:border lg:bg-background lg:shadow-[0_1px_3px_rgb(0_0_0/0.04)]">
        <UnofficialBanner className="lg:hidden" />
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter className="lg:hidden" />
      </div>
    </div>
  );
}
