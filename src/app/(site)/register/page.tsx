"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createUserWithEmailAndPassword } from "firebase/auth";
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

export default function RegisterPage() {
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
      await createUserWithEmailAndPassword(auth, email.trim(), password);
      router.push("/profile"); // next we’ll create profile doc on first visit
    } catch (err: any) {
      setError(err?.message ?? "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={2} component="form" onSubmit={onSubmit}>
        <Typography variant="h5" fontWeight={800}>
          Create account
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
          helperText="At least 6 characters (Firebase default)."
          value={password}
          autoComplete="new-password"
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
          {submitting ? "Creating..." : "Create account"}
        </Button>

        <Box>
          <Typography variant="body2" color="text.secondary">
            Already have an account?{" "}
            <Link href="/login" style={{ textDecoration: "none" }}>
              Log in
            </Link>
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}