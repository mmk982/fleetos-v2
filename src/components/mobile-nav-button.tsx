"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebarChrome } from "@/components/sidebar-chrome";

/** Hamburger that opens the mobile nav drawer (md:hidden). */
export function MobileNavButton() {
  const { openMobile } = useSidebarChrome();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={openMobile}
      aria-label="Open menu"
      className="md:hidden"
    >
      <Menu className="h-5 w-5" aria-hidden="true" />
    </Button>
  );
}
