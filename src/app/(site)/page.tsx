"use client";

import Link from "next/link";
import { Box, Button, Container, Paper, Stack, Typography } from "@mui/material";

export default function HomePage() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
      }}
    >
      <Container maxWidth="md">
        <Paper elevation={8} sx={{ p: { xs: 3, sm: 6 }, textAlign: "center" }}>
          <Stack spacing={3}>
            <Typography variant="h3" fontWeight={800}>
              WRKR
            </Typography>

            <Typography variant="h6" color="text.secondary">
              Find work or workers.
            </Typography>

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              justifyContent="center"
            >
              <Link href="/jobs" style={{ textDecoration: "none" }}>
                <Button variant="contained" size="large" fullWidth>
                  Browse Jobs
                </Button>
              </Link>

              <Link href="/jobs/new" style={{ textDecoration: "none" }}>
                <Button variant="outlined" size="large" fullWidth>
                  Post a Job
                </Button>
              </Link>
            </Stack>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}