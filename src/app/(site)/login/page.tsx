"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../../firebase/firebase";
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.push("/jobs");
    } catch (err: any) {
      setError(err?.message ?? "Login failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={2} component="form" onSubmit={onSubmit}>
        <Typography variant="h5" fontWeight={800}>
          Log in
        </Typography>

        {error && <Alert severity="error">{error}</Alert>}

        <TextField
          label="Email"
          type="email"
          value={email}
          autoComplete="email"
          onChange={(e) => setEmail(e.target.value)}
          required
          fullWidth
        />
        <TextField
          label="Password"
          type="password"
          value={password}
          autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)}
          required
          fullWidth
        />

        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={submitting}
        >
          {submitting ? "Logging in..." : "Log in"}
        </Button>

        <Box>
          <Typography variant="body2" color="text.secondary">
            Don’t have an account?{" "}
            <Link href="/register" style={{ textDecoration: "none" }}>
              Create one
            </Link>
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}