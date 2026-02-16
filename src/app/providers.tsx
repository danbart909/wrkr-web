"use client";

import { ThemeProvider, CssBaseline } from "@mui/material";
import { theme } from "../theme";
import { AuthProvider } from "../context/AuthContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>{children}</AuthProvider>
    </ThemeProvider>
  );
}