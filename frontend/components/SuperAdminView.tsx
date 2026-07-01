"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createOrganization,
  listOrganizations,
  Organization,
} from "@/lib/api";

export default function SuperAdminView() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadOrgs = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const data = await listOrganizations();
      setOrgs(Array.isArray(data) ? data : []);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreateError(null);
    setCreating(true);
    try {
      await createOrganization(trimmed);
      setName("");
      await loadOrgs();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="container">
      <div className="card stack-gap">
        <h2>Create organization</h2>
        {createError && <div className="error">{createError}</div>}
        <form onSubmit={handleCreate} className="row">
          <div className="field">
            <label htmlFor="orgName">Organization name</label>
            <input
              id="orgName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Inc."
              required
            />
          </div>
          <button type="submit" disabled={creating || !name.trim()}>
            {creating ? "Creating…" : "Create"}
          </button>
        </form>
      </div>

      <div className="card">
        <h2>Organizations</h2>
        {listError && <div className="error">{listError}</div>}

        {listLoading ? (
          <p className="empty">Loading…</p>
        ) : orgs.length === 0 ? (
          <p className="empty">No organizations yet. Create one above.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((org) => (
                <tr key={String(org.id)}>
                  <td>{org.id}</td>
                  <td>{org.name}</td>
                  <td>{formatDate(org.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function formatDate(value: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}
