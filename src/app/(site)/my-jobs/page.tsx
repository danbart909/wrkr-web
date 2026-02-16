"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import DeleteIcon from "@mui/icons-material/Delete";

import { RequireAuth } from "../../../components/RequireAuth";
import { useAuth } from "../../../context/AuthContext";
import { db } from "../../../firebase/firebase";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import Link from "next/link";

type JobListItem = {
  id: string;
  title?: string;
  tip?: number;
  pay?: number;
  standingOffer?: boolean;
  address?: string;
  zip?: string;
  creationDate?: any;
  endDate?: any;
};

function formatMoney(n?: number) {
  if (typeof n !== "number" || Number.isNaN(n)) return "";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function formatDateMaybe(ts: any) {
  // supports Firestore Timestamp or Date-like
  try {
    const d =
      ts?.toDate?.() instanceof Date
        ? ts.toDate()
        : ts instanceof Date
        ? ts
        : null;
    if (!d) return "";
    return d.toLocaleDateString();
  } catch {
    return "";
  }
}

export default function MyJobsPage() {
  return (
    <RequireAuth>
      <MyJobsInner />
    </RequireAuth>
  );
}

function MyJobsInner() {
  const { user } = useAuth();
  const uid = user!.uid;

  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [snack, setSnack] = useState<{ open: boolean; msg: string }>({
    open: false,
    msg: "",
  });

  const fetchJobs = useCallback(async () => {
    setError(null);
    try {
      const q = query(
        collection(db, "jobs"),
        where("userId", "==", uid),
        orderBy("creationDate", "desc")
      );

      const snap = await getDocs(q);

      const items: JobListItem[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));

      setJobs(items);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load your jobs.");
    }
  }, [uid]);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        setLoading(true);
        await fetchJobs();
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [fetchJobs]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchJobs();
    setRefreshing(false);
    setSnack({ open: true, msg: "Updated." });
  };

  const onDeleteJob = async (jobId: string, title?: string) => {
    const ok = window.confirm(
      `Delete this job${title ? `: "${title}"` : ""}? This cannot be undone.`
    );
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "jobs", jobId));
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
      setSnack({ open: true, msg: "Job deleted." });
    } catch (e: any) {
      setSnack({ open: true, msg: e?.message ?? "Failed to delete job." });
    }
  };

  if (loading) {
    return (
      <Paper sx={{ p: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <CircularProgress size={22} />
          <Typography>Loading your jobs...</Typography>
        </Stack>
      </Paper>
    );
  }

  return (
    <>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h5" fontWeight={800}>
              My Jobs
            </Typography>

            <IconButton onClick={onRefresh} disabled={refreshing} aria-label="Refresh">
              <RefreshIcon />
            </IconButton>
          </Stack>

          {error && <Alert severity="error">{error}</Alert>}

          {jobs.length === 0 ? (
            <Box sx={{ py: 4 }}>
              <Typography fontWeight={700}>No jobs yet.</Typography>
              <Typography color="text.secondary">
                When you post a job, it’ll show up here.
              </Typography>
            </Box>
          ) : (
            <Stack spacing={2}>
              {jobs.map((job) => {
                const tipValue = typeof job.tip === "number" ? job.tip : job.pay;
                const money = formatMoney(tipValue);
                const created = formatDateMaybe(job.creationDate);
                const end = formatDateMaybe(job.endDate);

                return (
                  <Paper
                    key={job.id}
                    variant="outlined"
                    sx={{ p: 2, borderRadius: 3 }}
                  >
                    <Stack spacing={1}>
                      <Stack direction="row" justifyContent="space-between" spacing={2}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography fontWeight={800} noWrap>
                            {job.title ?? "Untitled job"}
                          </Typography>

                          <Typography variant="body2" color="text.secondary">
                            {job.address
                              ? `${job.address}${job.zip ? ` • ${job.zip}` : ""}`
                              : job.zip
                              ? job.zip
                              : ""}
                          </Typography>
                        </Box>

                        <IconButton
                          aria-label="Delete job"
                          onClick={() => onDeleteJob(job.id, job.title)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Stack>

                      <Divider />

                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          {created ? `Posted ${created}` : "Posted"}
                        </Typography>

                        <Typography fontWeight={800}>
                          {money || ""}
                        </Typography>
                      </Stack>

                      <Typography variant="body2" color="text.secondary">
                        {job.standingOffer
                          ? "Standing offer"
                          : end
                          ? `Ends ${end}`
                          : "No end date"}
                      </Typography>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
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