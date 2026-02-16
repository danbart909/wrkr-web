"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { geocodeZip } from "../../../../utils/geo";

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
  const router = useRouter();
  const { user } = useAuth();
  const uid = user!.uid;

  const [profileAddress, setProfileAddress] = useState("");
  const [profileZip, setProfileZip] = useState("");
  const [profilePhone, setProfilePhone] = useState("");

  // Profile gate (like mobile app: require profile info before posting)
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>({
    state: "loading",
  });

  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [zip, setZip] = useState("");

  // Contact fields (new)
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const [tipText, setTipText] = useState(""); // keep as string for input
  const tipValue = useMemo(() => Number(tipText), [tipText]);

  const [standingOffer, setStandingOffer] = useState(false);
  const [endDate, setEndDate] = useState(""); // YYYY-MM-DD

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [snack, setSnack] = useState<{
    open: boolean;
    msg: string;
    severity: "success" | "error";
  }>({ open: false, msg: "", severity: "success" });

  const canPost = profileStatus.state === "ok";

  // Prefill contact email from auth (once)
  useEffect(() => {
    if (!user) return;
    setContactEmail((prev) => (prev.trim().length ? prev : user.email ?? ""));
  }, [user]);

  // Autofill once, but don't overwrite if user already typed something
  useEffect(() => {
    if (profileStatus.state === "ok") {
      setAddress((prev) => (prev.trim().length ? prev : profileAddress));
      setZip((prev) => (prev.trim().length ? prev : profileZip));

      // Prefill contact phone from profile (once)
      setContactPhone((prev) => (prev.trim().length ? prev : profilePhone));
    }
  }, [profileStatus.state, profileAddress, profileZip, profilePhone]);

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
        setProfilePhone(p.phone ?? "");

        if (missing.length)
          setProfileStatus({ state: "incomplete", missingFields: missing });
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

  const validate = (): string | null => {
    if (!canPost) return "Please complete your Profile before posting a job.";
    if (!title.trim()) return "Title is required.";
    if (!address.trim()) return "Address is required.";
    if (!zip.trim()) return "ZIP is required.";

    // Contact rule (new): at least one contact method
    const email = contactEmail.trim();
    const phone = contactPhone.trim();
    if (!email && !phone)
      return "Please provide at least one contact method: email or phone.";

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

      // Geocode ZIP -> store coords for distance sorting/filtering
      const coords = await geocodeZip(zip.trim());

      const docRef = await addDoc(collection(db, "jobs"), {
        userId: uid,
        title: title.trim(),
        description: description.trim() || "",

        address: address.trim(),
        zip: zip.trim(),

        // Contact info (new)
        ...(contactEmail.trim() ? { contactEmail: contactEmail.trim() } : {}),
        ...(contactPhone.trim() ? { contactPhone: contactPhone.trim() } : {}),

        // Prefer one consistent coordinate shape that your feed already supports
        ...(coords ? { location: { lat: coords.lat, lng: coords.lng } } : {}),

        tip: tipValue,
        standingOffer: !!standingOffer,
        endDate: endDateTs,
        creationDate: serverTimestamp(),
      });

      setSnack({ open: true, msg: "Job posted.", severity: "success" });

      // Redirect to newly created job page
      router.push(`/jobs/${docRef.id}`);
    } catch (e: any) {
      setSnack({
        open: true,
        msg: e?.message ?? "Failed to post job.",
        severity: "error",
      });
      setSubmitting(false);
      return;
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

  const contactValid = !!contactEmail.trim() || !!contactPhone.trim();

  // Normal create job form
  return (
    <>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2} component="form" onSubmit={onSubmit}>
          <Typography variant="h5" fontWeight={800}>
            Post a Job
          </Typography>

          {formError && <Alert severity="error">{formError}</Alert>}

          {!contactValid && (
            <Alert severity="info">
              Add at least one contact method (email or phone) so people can
              reach you.
            </Alert>
          )}

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

          {/* Contact section (new) */}
          <Typography fontWeight={800} sx={{ pt: 1 }}>
            Contact
          </Typography>

          <TextField
            label="Email (optional)"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            fullWidth
            helperText="Provide email and/or phone. At least one is required."
          />

          <TextField
            label="Phone (optional)"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            fullWidth
            helperText="Provide email and/or phone. At least one is required."
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