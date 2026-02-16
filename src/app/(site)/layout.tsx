"use client";

import { Box, Container } from "@mui/material";
import { MobileNav } from "./mobile-nav";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      {/* Content area */}
      <Container
        maxWidth="sm"
        sx={{
          px: 2,
          pt: 2,
          pb: 10, // space for bottom nav
        }}
      >
        {children}
      </Container>

      {/* Mobile-first nav */}
      <MobileNav />
    </Box>
  );
}
