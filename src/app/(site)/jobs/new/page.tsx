"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  Paper,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { RequireAuth } from "../../../../components/RequireAuth";
import { useAuth } from "../../../../context/AuthContext";
import { db } from "../../../../firebase/firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import type { UserProfile } from "../../../../types/userProfile";

type ProfileStatus =
  | { state: "loading" }
  | { state: "missing" }
  | { state: "incomplete"; missingFields: string[] }
  | { state: "ok" };

function isNonEmpty(s: unknown) {
  return typeof s === "string" && s.trim().length > 0;
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function NewJobPage() {
  return (
    <RequireAuth>
      <NewJobInner />
    </RequireAuth>
  );
}

function NewJobInner() {
  const { user } = useAuth();
  const uid = user!.uid;

  const [profileAddress, setProfileAddress] = useState("");
  const [profileZip, setProfileZip] = useState("");

  // Profile gate (like mobile app: require profile info before posting)
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>({
    state: "loading",
  });https://1337x.to/search/dracula/1/

  useEffect(() => {
  // Autofill once, but don't overwrite if user already typed something
    if (profileStatus.state === "ok") {
      setAddress((prev) => (prev.trim().length ? prev : profileAddress));
      setZip((prev) => (prev.trim().length ? prev : profileZip));
    }
  }, [profileStatus.state, profileAddress, profileZip]);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const ref = doc(db, "users", uid);
        const snap = await getDoc(ref);
        if (!active) return;

        if (!snap.exists()) {
          setProfileStatus({ state: "missing" });
          return;
        }

        const p = snap.data() as Partial<UserProfile>;
        const missing: string[] = [];
        if (!isNonEmpty(p.name)) missing.push("name");
        if (!isNonEmpty(p.phone)) missing.push("phone");
        if (!isNonEmpty(p.address)) missing.push("address");
        if (!isNonEmpty(p.zip)) missing.push("zip");
        setProfileAddress(p.address ?? "");
        setProfileZip(p.zip ?? "");

        if (missing.length) setProfileStatus({ state: "incomplete", missingFields: missing });
        else setProfileStatus({ state: "ok" });
      } catch {
        // If Firestore errors, treat like missing until we know more
        setProfileStatus({ state: "missing" });
      }
    })();

    return () => {
      active = false;
    };
  }, [uid]);

  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [zip, setZip] = useState("");

  const [tipText, setTipText] = useState(""); // keep as string for input
  const tipValue = useMemo(() => Number(tipText), [tipText]);

  const [standingOffer, setStandingOffer] = useState(false);
  const [endDate, setEndDate] = useState(""); // YYYY-MM-DD

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: "success" | "error" }>(
    { open: false, msg: "", severity: "success" }
  );

  const canPost = profileStatus.state === "ok";

  const validate = (): string | null => {
    if (!canPost) return "Please complete your Profile before posting a job.";
    if (!title.trim()) return "Title is required.";
    if (!address.trim()) return "Address is required.";
    if (!zip.trim()) return "ZIP is required.";

    if (!tipText.trim()) return "Tip is required.";
    if (Number.isNaN(tipValue)) return "Tip must be a number.";
    if (tipValue <= 0) return "Tip must be greater than 0.";

    if (!standingOffer) {
      if (!endDate) return "Choose an End Date or enable Standing Offer.";
      const chosen = new Date(endDate + "T00:00:00");
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (chosen < today) return "End Date cannot be in the past.";
    }

    return null;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const err = validate();
    if (err) {
      setFormError(err);
      return;
    }

    setSubmitting(true);
    try {
      const endDateTs = standingOffer
        ? null
        : Timestamp.fromDate(new Date(endDate + "T00:00:00"));

      await addDoc(collection(db, "jobs"), {
        userId: uid,
        title: title.trim(),
        description: description.trim() || "",

        address: address.trim(),
        zip: zip.trim(),

        tip: tipValue,
        standingOffer: !!standingOffer,
        endDate: endDateTs,
        creationDate: serverTimestamp(),
      });

      // Reset form
      setTitle("");
      setDescription("");
      setAddress("");
      setZip("");
      setTipText("");
      setStandingOffer(false);
      setEndDate("");

      setSnack({ open: true, msg: "Job posted.", severity: "success" });
    } catch (e: any) {
      setSnack({ open: true, msg: e?.message ?? "Failed to post job.", severity: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Profile gating UI
  if (profileStatus.state === "loading") {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography>Loading...</Typography>
      </Paper>
    );
  }

  if (profileStatus.state === "missing") {
    return (
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h5" fontWeight={800}>
            Post a Job
          </Typography>

          <Alert severity="warning">
            You need a Profile before you can post a job.
          </Alert>

          <Link href="/profile" style={{ textDecoration: "none" }}>
            <Button variant="contained" size="large">
              Go to Profile
            </Button>
          </Link>
        </Stack>
      </Paper>
    );
  }

  if (profileStatus.state === "incomplete") {
    return (
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h5" fontWeight={800}>
            Post a Job
          </Typography>

          <Alert severity="warning">
            Please complete your Profile before posting.
            <Box component="span" sx={{ display: "block", mt: 1 }}>
              Missing: {profileStatus.missingFields.join(", ")}
            </Box>
          </Alert>

          <Link href="/profile" style={{ textDecoration: "none" }}>
            <Button variant="contained" size="large">
              Complete Profile
            </Button>
          </Link>
        </Stack>
      </Paper>
    );
  }

  // Normal create job form
  return (
    <>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2} component="form" onSubmit={onSubmit}>
          <Typography variant="h5" fontWeight={800}>
            Post a Job
          </Typography>

          {formError && <Alert severity="error">{formError}</Alert>}

          <TextField
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            fullWidth
          />

          <TextField
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            minRows={3}
            fullWidth
          />

          <TextField
            label="Address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
            fullWidth
          />

          <TextField
            label="ZIP"
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            required
            fullWidth
            inputMode="numeric"
          />

          <TextField
            label="Tip ($)"
            value={tipText}
            onChange={(e) => setTipText(e.target.value)}
            required
            fullWidth
            inputMode="decimal"
          />

          <FormControlLabel
            control={
              <Switch
                checked={standingOffer}
                onChange={(e) => setStandingOffer(e.target.checked)}
              />
            }
            label="Standing Offer"
          />

          {!standingOffer && (
            <TextField
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ min: todayISO() }}
              required
              fullWidth
            />
          )}

          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={submitting}
          >
            {submitting ? "Posting..." : "Post Job"}
          </Button>
        </Stack>
      </Paper>

      <Snackbar
        open={snack.open}
        autoHideDuration={2200}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        message={snack.msg}
      />
    </>
  );
}