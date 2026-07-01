"use client";

import { useRouter } from "next/navigation";
import { clearSession } from "@/lib/auth";
import type { AuthUser } from "@/lib/api";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  org_admin: "Org Admin",
  end_user: "End User",
};

export default function Nav({ user }: { user: AuthUser | null }) {
  const router = useRouter();

  function handleLogout() {
    clearSession();
    router.replace("/login");
  }

  const roleLabel = user?.role ? ROLE_LABELS[user.role] || user.role : "";

  return (
    <div className="topbar">
      <span className="brand">Feature Flags</span>
      <div className="who">
        <span className="who-meta">
          {user?.email || "—"}
          {roleLabel && <span className="role-badge">{roleLabel}</span>}
        </span>
        <button className="secondary" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </div>
  );
}
