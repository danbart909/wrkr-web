"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Paper,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteIcon from "@mui/icons-material/Delete";

import { db } from "../../../../firebase/firebase";
import { doc, getDoc, deleteDoc } from "firebase/firestore";
import { useAuth } from "../../../../context/AuthContext";

type JobDoc = {
  userId?: string;
  title?: string;
  description?: string;
  address?: string;
  zip?: string;

  tip?: number;
  pay?: number; // legacy

  standingOffer?: boolean;
  endDate?: any;
  creationDate?: any;

  location?: { latitude: number; longitude: number } | { lat: number; lng: number } | any;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
};

const normalize = (s: unknown) => (typeof s === "string" ? s.trim() : "");

function tsToDate(ts: any): Date | null {
  try {
    if (!ts) return null;
    if (typeof ts.toDate === "function") return ts.toDate();
    if (ts instanceof Date) return ts;
    return null;
  } catch {
    return null;
  }
}

function tipOf(job: JobDoc): number {
  const t = typeof job.tip === "number" ? job.tip : undefined;
  const p = typeof job.pay === "number" ? job.pay : undefined;
  return t ?? p ?? 0;
}

function formatMoney(n: number) {
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default function JobDetailsPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const { user } = useAuth();

  const [job, setJob] = useState<JobDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [busyDelete, setBusyDelete] = useState(false);
  const [snack, setSnack] = useState<{ open: boolean; msg: string }>({ open: false, msg: "" });

  const isOwner = useMemo(() => {
    if (!user || !job) return false;
    return job.userId === user.uid;
  }, [user, job]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        if (!id) {
          setErr("Missing job id.");
          return;
        }

        const ref = doc(db, "jobs", id);
        const snap = await getDoc(ref);

        if (cancelled) return;

        if (!snap.exists()) {
          setErr("Job not found.");
          setJob(null);
          return;
        }

        setJob(snap.data() as JobDoc);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Failed to load job.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const onDelete = async () => {
    if (!id) return;
    const ok = window.confirm("Delete this job? This cannot be undone.");
    if (!ok) return;

    setBusyDelete(true);
    try {
      await deleteDoc(doc(db, "jobs", id));
      setSnack({ open: true, msg: "Job deleted." });
      // go back to My Jobs (or jobs list)
      router.push("/my-jobs");
    } catch (e: any) {
      setSnack({ open: true, msg: e?.message ?? "Failed to delete job." });
    } finally {
      setBusyDelete(false);
    }
  };

  return (
    <>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Link href="/jobs" style={{ textDecoration: "none" }}>
            <Button startIcon={<ArrowBackIcon />} variant="text">
              Back to Jobs
            </Button>
          </Link>

          {loading && (
            <Stack direction="row" spacing={2} alignItems="center">
              <CircularProgress size={22} />
              <Typography>Loading job...</Typography>
            </Stack>
          )}

          {!loading && err && <Alert severity="error">{err}</Alert>}

          {!loading && !err && job && (
            <>
              <Stack spacing={0.5}>
                <Typography variant="h5" fontWeight={900}>
                  {job.title ?? "Untitled job"}
                </Typography>

                <Typography variant="body2" color="text.secondary">
                  {normalize(job.address)
                    ? `${normalize(job.address)}${normalize(job.zip) ? ` • ${normalize(job.zip)}` : ""}`
                    : normalize(job.zip)}
                </Typography>
              </Stack>

              <Box
                sx={{
                  p: 2,
                  borderRadius: 3,
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Stack direction="row" justifyContent="space-between">
                  <Typography fontWeight={800}>Tip</Typography>
                  <Typography fontWeight={900}>{formatMoney(tipOf(job))}</Typography>
                </Stack>

                <Divider sx={{ my: 1.5 }} />

                <Stack spacing={0.5}>
                  <Typography variant="body2" color="text.secondary">
                    {job.standingOffer
                      ? "Standing offer"
                      : tsToDate(job.endDate)
                      ? `Ends ${tsToDate(job.endDate)!.toLocaleDateString()}`
                      : "No end date"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {tsToDate(job.creationDate)
                      ? `Posted ${tsToDate(job.creationDate)!.toLocaleDateString()}`
                      : "Posted"}
                  </Typography>
                </Stack>
              </Box>

              {normalize(job.description) && (
                <Box>
                  <Typography fontWeight={800} sx={{ mb: 1 }}>
                    Description
                  </Typography>
                  <Typography color="text.secondary">
                    {normalize(job.description)}
                  </Typography>
                </Box>
              )}

              {isOwner && (
                <Box sx={{ pt: 1 }}>
                  <Button
                    color="error"
                    variant="contained"
                    size="large"
                    startIcon={<DeleteIcon />}
                    onClick={onDelete}
                    disabled={busyDelete}
                    fullWidth
                  >
                    {busyDelete ? "Deleting..." : "Delete job"}
                  </Button>
                </Box>
              )}
            </>
          )}
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