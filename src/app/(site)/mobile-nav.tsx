"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BottomNavigation,
  BottomNavigationAction,
  Paper,
} from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import SearchIcon from "@mui/icons-material/Search";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import PersonIcon from "@mui/icons-material/Person";
import WorkIcon from "@mui/icons-material/Work";

const tabs = [
  { label: "Home", value: "/", icon: <HomeIcon /> },
  { label: "Jobs", value: "/jobs", icon: <SearchIcon /> },
  { label: "Post", value: "/jobs/new", icon: <AddCircleIcon /> },
  { label: "Profile", value: "/profile", icon: <PersonIcon /> },
  { label: "My Jobs", value: "/my-jobs", icon: <WorkIcon /> },
];

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();

  // Keep selection stable even on nested routes
  const current =
    pathname === "/"
      ? "/"
      : pathname.startsWith("/jobs/new")
      ? "/jobs/new"
      : pathname.startsWith("/jobs")
      ? "/jobs"
      : pathname.startsWith("/my-jobs")
      ? "/my-jobs"
      : pathname.startsWith("/profile")
      ? "/profile"
      : "/";

  return (
    <Paper
      elevation={10}
      sx={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        overflow: "hidden",
      }}
    >
      <BottomNavigation
        showLabels
        value={current}
        onChange={(_, next) => router.push(next)}
      >
        {tabs.map((t) => (
          <BottomNavigationAction
            key={t.value}
            label={t.label}
            value={t.value}
            icon={t.icon}
          />
        ))}
      </BottomNavigation>
    </Paper>
  );
}
