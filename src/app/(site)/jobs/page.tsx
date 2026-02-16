"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import LocationSearchingIcon from "@mui/icons-material/LocationSearching";

import type { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
} from "firebase/firestore";

import { db } from "../../../firebase/firebase";
import {
  geocodeZip,
  haversineMiles,
  formatMiles,
  type LatLng,
} from "../../../utils/geo";

import Link from "next/link";

type JobFeedItem = {
  id: string;
  userId?: string;

  title?: string;
  description?: string;

  address?: string;
  zip?: string;

  tip?: number; // preferred
  pay?: number; // legacy fallback

  standingOffer?: boolean;
  endDate?: any; // Firestore Timestamp | null
  creationDate?: any; // Firestore Timestamp

  // possible coordinate shapes:
  location?: { latitude: number; longitude: number } | { lat: number; lng: number } | any;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
};

type SortMode = "newest" | "tipHigh" | "tipLow" | "distance";

const PAGE_SIZE = 25;
const normalize = (s: unknown) => (typeof s === "string" ? s.trim() : "");

function tipOf(job: JobFeedItem): number {
  const t = typeof job.tip === "number" ? job.tip : undefined;
  const p = typeof job.pay === "number" ? job.pay : undefined;
  return t ?? p ?? 0;
}

function formatMoney(n: number) {
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

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

function isActive(job: JobFeedItem) {
  if (job.standingOffer) return true;

  const d = tsToDate(job.endDate);
  if (!d) return true;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const end = new Date(d);
  end.setHours(0, 0, 0, 0);

  return end >= today;
}

function jobCoords(job: JobFeedItem): LatLng | null {
  // Firestore GeoPoint-ish
  if (
    job.location &&
    typeof job.location.latitude === "number" &&
    typeof job.location.longitude === "number"
  ) {
    return { lat: job.location.latitude, lng: job.location.longitude };
  }

  if (job.location && typeof job.location.lat === "number" && typeof job.location.lng === "number") {
    return { lat: job.location.lat, lng: job.location.lng };
  }

  if (typeof job.latitude === "number" && typeof job.longitude === "number") {
    return { lat: job.latitude, lng: job.longitude };
  }

  if (typeof job.lat === "number" && typeof job.lng === "number") {
    return { lat: job.lat, lng: job.lng };
  }

  return null;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [snack, setSnack] = useState<{ open: boolean; msg: string }>({
    open: false,
    msg: "",
  });

  // Pagination (ref avoids effect loops)
  const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filters
  const [searchText, setSearchText] = useState("");
  const [zipFilter, setZipFilter] = useState("");

  // Distance + radius
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [originSource, setOriginSource] = useState<"geo" | "zip" | null>(null);
  const [originZip, setOriginZip] = useState("");
  const [originBusy, setOriginBusy] = useState(false);

  const [radiusMiles, setRadiusMiles] = useState<number>(10);
  const [enableRadius, setEnableRadius] = useState(false);

  const [sort, setSort] = useState<SortMode>("newest");

  const fetchJobsPage = useCallback(async (mode: "reset" | "more") => {
    setError(null);

    const isReset = mode === "reset";
    if (isReset) {
      setHasMore(true);
      lastDocRef.current = null;
    }

    try {
      const base = query(
        collection(db, "jobs"),
        orderBy("creationDate", "desc"),
        limit(PAGE_SIZE)
      );

      const q =
        !isReset && lastDocRef.current
          ? query(
              collection(db, "jobs"),
              orderBy("creationDate", "desc"),
              startAfter(lastDocRef.current),
              limit(PAGE_SIZE)
            )
          : base;

      const snap = await getDocs(q);

      const items: JobFeedItem[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));

      if (snap.docs.length > 0) {
        lastDocRef.current = snap.docs[snap.docs.length - 1];
      }

      setHasMore(snap.docs.length === PAGE_SIZE);

      if (isReset) {
        setJobs(items);
      } else {
        setJobs((prev) => {
          const seen = new Set(prev.map((x) => x.id));
          const merged = [...prev];
          for (const it of items) if (!seen.has(it.id)) merged.push(it);
          return merged;
        });
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to load jobs.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        await fetchJobsPage("reset");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchJobsPage]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchJobsPage("reset");
    setRefreshing(false);
    setSnack({ open: true, msg: "Updated." });
  };

  const useBrowserLocation = async () => {
    setOriginBusy(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation)
          return reject(new Error("Geolocation not supported."));
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 30000,
        });
      });

      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setOrigin(coords);
      setOriginSource("geo");
      setSnack({ open: true, msg: "Using your location." });
    } catch (e: any) {
      setSnack({ open: true, msg: e?.message ?? "Could not get location." });
    } finally {
      setOriginBusy(false);
    }
  };

  const useZipLocation = async () => {
    const z = normalize(originZip);
    if (!z) {
      setSnack({ open: true, msg: "Enter a ZIP first." });
      return;
    }

    setOriginBusy(true);
    try {
      const coords = await geocodeZip(z);
      if (!coords) {
        setSnack({ open: true, msg: "Could not find that ZIP." });
        return;
      }
      setOrigin(coords);
      setOriginSource("zip");
      setSnack({ open: true, msg: "Using ZIP location." });
    } catch (e: any) {
      setSnack({ open: true, msg: e?.message ?? "ZIP lookup failed." });
    } finally {
      setOriginBusy(false);
    }
  };

  const computed = useMemo(() => {
    const originCoords = origin;
    return jobs.map((j) => {
      const jc = jobCoords(j);
      const miles = originCoords && jc ? haversineMiles(originCoords, jc) : null;
      return { job: j, miles, hasCoords: !!jc };
    });
  }, [jobs, origin]);

  const stats = useMemo(() => {
    const total = computed.length;
    const haveCoords = computed.filter((x) => x.hasCoords).length;
    return { total, haveCoords, missingCoords: total - haveCoords };
  }, [computed]);

  const visibleJobs = useMemo(() => {
    const s = normalize(searchText).toLowerCase();
    const z = normalize(zipFilter);

    let list = computed.filter(({ job }) => isActive(job));

    if (z) {
      list = list.filter(({ job }) => normalize(job.zip) === z);
    }

    if (s) {
      list = list.filter(({ job }) => {
        const title = normalize(job.title).toLowerCase();
        const desc = normalize(job.description).toLowerCase();
        return title.includes(s) || desc.includes(s);
      });
    }

    if (enableRadius) {
      if (!origin) {
        list = [];
      } else {
        list = list.filter(
          (x) => typeof x.miles === "number" && x.miles <= radiusMiles
        );
      }
    }

    const copy = [...list];

    if (sort === "newest") {
      copy.sort((a, b) => {
        const da = tsToDate(a.job.creationDate)?.getTime() ?? 0;
        const dbb = tsToDate(b.job.creationDate)?.getTime() ?? 0;
        return dbb - da;
      });
    } else if (sort === "tipHigh") {
      copy.sort((a, b) => tipOf(b.job) - tipOf(a.job));
    } else if (sort === "tipLow") {
      copy.sort((a, b) => tipOf(a.job) - tipOf(b.job));
    } else if (sort === "distance") {
      copy.sort((a, b) => {
        const da =
          typeof a.miles === "number" ? a.miles : Number.POSITIVE_INFINITY;
        const dbb =
          typeof b.miles === "number" ? b.miles : Number.POSITIVE_INFINITY;
        return da - dbb;
      });
    }

    return copy;
  }, [
    computed,
    searchText,
    zipFilter,
    enableRadius,
    origin,
    radiusMiles,
    sort,
  ]);

  return (
    <>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h5" fontWeight={800}>
              Jobs
            </Typography>

            <IconButton onClick={onRefresh} disabled={refreshing} aria-label="Refresh">
              <RefreshIcon />
            </IconButton>
          </Stack>

          {/* Distance controls */}
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
            <Stack spacing={1.5}>
              <Typography fontWeight={800}>Distance</Typography>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button
                  variant="contained"
                  startIcon={<MyLocationIcon />}
                  onClick={useBrowserLocation}
                  disabled={originBusy}
                  fullWidth
                >
                  Use my location
                </Button>

                <Button
                  variant="outlined"
                  startIcon={<LocationSearchingIcon />}
                  onClick={useZipLocation}
                  disabled={originBusy}
                  fullWidth
                >
                  Use ZIP
                </Button>
              </Stack>

              <TextField
                label="Your ZIP (fallback)"
                value={originZip}
                onChange={(e) => setOriginZip(e.target.value)}
                fullWidth
                inputMode="numeric"
              />

              <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
                <FormControl size="small" sx={{ minWidth: 170 }}>
                  <InputLabel id="radius-label">Radius</InputLabel>
                  <Select
                    labelId="radius-label"
                    label="Radius"
                    value={radiusMiles}
                    onChange={(e) => setRadiusMiles(Number(e.target.value))}
                  >
                    {[5, 10, 25, 50, 100].map((r) => (
                      <MenuItem key={r} value={r}>
                        {r} miles
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Button
                  variant={enableRadius ? "contained" : "outlined"}
                  onClick={() => setEnableRadius((v) => !v)}
                >
                  {enableRadius ? "Radius ON" : "Radius OFF"}
                </Button>
              </Stack>

              <Typography variant="body2" color="text.secondary">
                {origin
                  ? `Origin set (${originSource === "geo" ? "your location" : "ZIP"}).`
                  : "Set your location or ZIP to sort/filter by distance."}
              </Typography>

              {enableRadius && !origin && (
                <Alert severity="info">
                  Turn on “Use my location” or “Use ZIP” to filter by radius.
                </Alert>
              )}

              {origin && stats.missingCoords > 0 && (
                <Alert severity="warning">
                  {stats.missingCoords} job(s) don’t have coordinates, so they can’t be distance-filtered.
                </Alert>
              )}
            </Stack>
          </Paper>

          {/* Other filters */}
          <TextField
            label="Search"
            placeholder="Try: moving, yard, drywall..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            fullWidth
          />

          <TextField
            label="ZIP (job ZIP filter, optional)"
            value={zipFilter}
            onChange={(e) => setZipFilter(e.target.value)}
            fullWidth
            inputMode="numeric"
          />

          <FormControl fullWidth>
            <InputLabel id="sort-label">Sort</InputLabel>
            <Select
              labelId="sort-label"
              label="Sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
            >
              <MenuItem value="newest">Newest</MenuItem>
              <MenuItem value="distance">Distance</MenuItem>
              <MenuItem value="tipHigh">Tip (high → low)</MenuItem>
              <MenuItem value="tipLow">Tip (low → high)</MenuItem>
            </Select>
          </FormControl>

          {loading && (
            <Stack direction="row" spacing={2} alignItems="center">
              <CircularProgress size={22} />
              <Typography>Loading jobs...</Typography>
            </Stack>
          )}

          {error && <Alert severity="error">{error}</Alert>}

          {!loading && !error && visibleJobs.length === 0 && (
            <Box sx={{ py: 3 }}>
              <Typography fontWeight={800}>No jobs found.</Typography>
              <Typography color="text.secondary">
                Try clearing filters, turning off radius, or refresh.
              </Typography>
            </Box>
          )}

          {!loading && visibleJobs.length > 0 && (
            <Stack spacing={2}>
              {visibleJobs.map(({ job, miles }) => {
                const tip = tipOf(job);
                const money = tip ? formatMoney(tip) : "";
                const end = tsToDate(job.endDate);
                const posted = tsToDate(job.creationDate);

                return (
                  <Link href={`/jobs/${job.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                    <Paper
                      key={job.id}
                      variant="outlined"
                      sx={{
                        p: 2,
                        borderRadius: 3,
                        cursor: "pointer",
                        "&:active": { transform: "scale(0.99)" },
                      }}
                    >
                    <Stack spacing={1}>
                      <Stack direction="row" justifyContent="space-between" spacing={2}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography fontWeight={800} noWrap>
                            {job.title ?? "Untitled job"}
                          </Typography>

                          <Typography variant="body2" color="text.secondary">
                            {normalize(job.address)
                              ? `${normalize(job.address)}${normalize(job.zip) ? ` • ${normalize(job.zip)}` : ""}`
                              : normalize(job.zip)}
                          </Typography>
                        </Box>

                        <Box sx={{ textAlign: "right" }}>
                          <Typography fontWeight={900}>{money}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            Tip
                          </Typography>
                        </Box>
                      </Stack>

                      {origin && typeof miles === "number" && (
                        <Typography variant="body2" color="text.secondary">
                          {formatMiles(miles)} away
                        </Typography>
                      )}

                      {normalize(job.description) && (
                        <Typography variant="body2" color="text.secondary">
                          {normalize(job.description)}
                        </Typography>
                      )}

                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">
                          {posted ? `Posted ${posted.toLocaleDateString()}` : "Posted"}
                        </Typography>

                        <Typography variant="body2" color="text.secondary">
                          {job.standingOffer
                            ? "Standing offer"
                            : end
                            ? `Ends ${end.toLocaleDateString()}`
                            : "No end date"}
                        </Typography>
                      </Stack>
                    </Stack>
                  </Paper>
                  </Link>
                );
              })}

              {/* Pagination controls */}
              {hasMore && (
                <Button
                  variant="outlined"
                  size="large"
                  fullWidth
                  disabled={loadingMore}
                  onClick={async () => {
                    setLoadingMore(true);
                    await fetchJobsPage("more");
                    setLoadingMore(false);
                  }}
                >
                  {loadingMore ? "Loading..." : "Load more"}
                </Button>
              )}

              {!hasMore && jobs.length > 0 && (
                <Typography variant="body2" color="text.secondary" textAlign="center">
                  You’ve reached the end.
                </Typography>
              )}
            </Stack>
          )}
        </Stack>
      </Paper>

      <Snackbar
        open={snack.open}
        autoHideDuration={2000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        message={snack.msg}
      />
    </>
  );
}