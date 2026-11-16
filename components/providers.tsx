"use client";

import * as Tooltip from "@radix-ui/react-tooltip";
import { ThemeProvider } from "next-themes";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange={false}>
      <Tooltip.Provider>{children}</Tooltip.Provider>
    </ThemeProvider>
  );
}
