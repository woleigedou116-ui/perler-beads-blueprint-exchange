import type { ReactNode } from "react";

import { I18nProvider } from "../../shared/i18n";
import { ThemeProvider } from "../../shared/theme";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <I18nProvider>{children}</I18nProvider>
    </ThemeProvider>
  );
}
