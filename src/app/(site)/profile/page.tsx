"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Divider,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { RequireAuth } from "../../../components/RequireAuth";
import { useAuth } from "../../../context/AuthContext";
import { auth, db } from "../../../firebase/firebase";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  signOut,
  deleteUser,
} from "firebase/auth";
import { collection, getDocs, query, where, writeBatch } from "firebase/firestore";
import type { UserProfile } from "../../../types/userProfile";

function profileDocRef(uid: string) {
  return doc(db, "users", uid);
}

export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileInner />
    </RequireAuth>
  );
}

function ProfileInner() {
  const { user } = useAuth();

  const uid = user!.uid;
  const email = user!.email ?? "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [zip, setZip] = useState("");

  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: "success" | "error" }>(
    { open: false, msg: "", severity: "success" }
  );

  // Password change fields
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  // Delete account fields
  const [deletePw, setDeletePw] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const dirty = useMemo(() => {
    // basic: if any field is non-empty (we'll also track initial values implicitly by saving)
    return true;
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const ref = profileDocRef(uid);
        const snap = await getDoc(ref);

        if (!active) return;

        if (!snap.exists()) {
          // Create a doc on first visit (minimal + editable fields)
          const initial: UserProfile = {
            uid,
            name: "",
            phone: "",
            address: "",
            zip: "",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          await setDoc(ref, initial);
          setName("");
          setPhone("");
          setAddress("");
          setZip("");
        } else {
          const data = snap.data() as Partial<UserProfile>;
          setName(data.name ?? "");
          setPhone(data.phone ?? "");
          setAddress(data.address ?? "");
          setZip(data.zip ?? "");
        }
      } catch (e: any) {
        setSnack({ open: true, msg: e?.message ?? "Failed to load profile.", severity: "error" });
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [uid]);

  const onSave = async () => {
    setSaving(true);
    try {
      const ref = profileDocRef(uid);
      await updateDoc(ref, {
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        zip: zip.trim(),
        updatedAt: serverTimestamp(),
      });

      setSnack({ open: true, msg: "Profile saved.", severity: "success" });
    } catch (e: any) {
      setSnack({ open: true, msg: e?.message ?? "Failed to save profile.", severity: "error" });
    } finally {
      setSaving(false);
    }
  };

  const onChangePassword = async () => {
    setPwError(null);
    setPwBusy(true);
    try {
      if (!email) throw new Error("No email found for this account.");
      if (newPw.length < 6) throw new Error("New password must be at least 6 characters.");

      const cred = EmailAuthProvider.credential(email, currentPw);
      await reauthenticateWithCredential(user!, cred);
      await updatePassword(user!, newPw);

      setCurrentPw("");
      setNewPw("");
      setSnack({ open: true, msg: "Password updated.", severity: "success" });
    } catch (e: any) {
      setPwError(e?.message ?? "Failed to update password.");
    } finally {
      setPwBusy(false);
    }
  };

  const onLogout = async () => {
    await signOut(auth);
    // RequireAuth will redirect them to /login automatically
  };

  const deleteAllUserJobs = async (uidToDelete: string) => {
    // Delete jobs in batches of 400-ish (keep under 500 write limit)
    const jobsQ = query(collection(db, "jobs"), where("userId", "==", uidToDelete));
    const snap = await getDocs(jobsQ);

    if (snap.empty) return;

    let batch = writeBatch(db);
    let ops = 0;

    for (const d of snap.docs) {
      batch.delete(d.ref);
      ops += 1;
      if (ops >= 400) {
        await batch.commit();
        batch = writeBatch(db);
        ops = 0;
      }
    }

    if (ops > 0) await batch.commit();
  };

  const onDeleteAccount = async () => {
    setDeleteError(null);
    setDeleteBusy(true);

    try {
      if (!email) throw new Error("No email found for this account.");
      // confirm via browser prompt (simple + effective mobile-first)
      const ok = window.confirm(
        "Delete your account permanently? This will delete your profile and all jobs you posted."
      );
      if (!ok) return;

      // Reauth required to delete user
      const cred = EmailAuthProvider.credential(email, deletePw);
      await reauthenticateWithCredential(user!, cred);

      // Delete user's jobs, then profile doc, then auth user
      await deleteAllUserJobs(uid);

      // delete profile doc
      await updateDoc(profileDocRef(uid), { updatedAt: serverTimestamp() }).catch(() => {});
      // Better: actually delete the doc
      // (using deleteDoc; imported inline to keep this compact)
      const { deleteDoc } = await import("firebase/firestore");
      await deleteDoc(profileDocRef(uid));

      await deleteUser(user!);

      // If deleteUser succeeds, auth state changes → RequireAuth redirects
    } catch (e: any) {
      setDeleteError(e?.message ?? "Failed to delete account.");
    } finally {
      setDeleteBusy(false);
    }
  };

  if (loading) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography>Loading profile...</Typography>
      </Paper>
    );
  }

  return (
    <>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h5" fontWeight={800}>
            Profile
          </Typography>

          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
          <TextField
            label="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            fullWidth
            inputMode="tel"
          />
          <TextField
            label="Address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            fullWidth
          />
          <TextField
            label="ZIP"
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            fullWidth
            inputMode="numeric"
          />

          <Button variant="contained" size="large" onClick={onSave} disabled={saving || !dirty}>
            {saving ? "Saving..." : "Save"}
          </Button>

          <Divider sx={{ my: 1 }} />

          <Typography variant="h6" fontWeight={800}>
            Change password
          </Typography>

          {pwError && <Alert severity="error">{pwError}</Alert>}

          <TextField
            label="Current password"
            type="password"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            fullWidth
          />
          <TextField
            label="New password"
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            fullWidth
            helperText="At least 6 characters."
          />

          <Button
            variant="outlined"
            size="large"
            onClick={onChangePassword}
            disabled={pwBusy || !currentPw || !newPw}
          >
            {pwBusy ? "Updating..." : "Update password"}
          </Button>

          <Divider sx={{ my: 1 }} />

          <Typography variant="h6" fontWeight={800}>
            Account
          </Typography>

          <Button variant="text" onClick={onLogout}>
            Log out
          </Button>

          <Box sx={{ p: 2, borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
            <Stack spacing={1.5}>
              <Typography fontWeight={800} color="error">
                Danger zone
              </Typography>

              {deleteError && <Alert severity="error">{deleteError}</Alert>}

              <TextField
                label="Password to confirm"
                type="password"
                value={deletePw}
                onChange={(e) => setDeletePw(e.target.value)}
                fullWidth
              />

              <Button
                color="error"
                variant="contained"
                size="large"
                onClick={onDeleteAccount}
                disabled={deleteBusy || !deletePw}
              >
                {deleteBusy ? "Deleting..." : "Delete account"}
              </Button>
            </Stack>
          </Box>
        </Stack>
      </Paper>

      <Snackbar
        open={snack.open}
        autoHideDuration={2500}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        message={snack.msg}
      />
    </>
  );
}