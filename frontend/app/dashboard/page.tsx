"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken, getUser } from "@/lib/auth";
import type { AuthUser } from "@/lib/api";
import Nav from "@/components/Nav";
import SuperAdminView from "@/components/SuperAdminView";
import OrgAdminView from "@/components/OrgAdminView";
import EndUserView from "@/components/EndUserView";

export default function DashboardPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  // Auth gate — runs only in the browser.
  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setUser(getUser());
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="center">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="page">
      <Nav user={user} />
      {renderRoleView(user?.role)}
    </div>
  );
}

function renderRoleView(role: string | undefined) {
  switch (role) {
    case "super_admin":
      return <SuperAdminView />;
    case "org_admin":
      return <OrgAdminView />;
    case "end_user":
      return <EndUserView />;
    default:
      return (
        <div className="container">
          <div className="card">
            <h2>No access for this role</h2>
            <p className="muted">
              Your account does not have a dashboard view assigned. Please
              contact an administrator.
            </p>
          </div>
        </div>
      );
  }
}
