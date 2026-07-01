"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createFlag,
  deleteFlag,
  Flag,
  getFlags,
  updateFlag,
} from "@/lib/api";

export default function OrgAdminView() {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newKey, setNewKey] = useState("");
  const [newEnabled, setNewEnabled] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [busyId, setBusyId] = useState<string | null>(null);

  const loadFlags = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getFlags();
      setFlags(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load flags");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFlags();
  }, [loadFlags]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const key = newKey.trim();
    if (!key) {
      setCreateError("Feature key is required");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const created = await createFlag({ feature_key: key, enabled: newEnabled });
      setFlags((prev) => [created, ...prev]);
      setNewKey("");
      setNewEnabled(false);
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Failed to create flag"
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(flag: Flag) {
    setBusyId(flag.id);
    setError(null);
    try {
      const updated = await updateFlag(flag.id, { enabled: !flag.enabled });
      setFlags((prev) => prev.map((f) => (f.id === flag.id ? updated : f)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update flag");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(flag: Flag) {
    setBusyId(flag.id);
    setError(null);
    try {
      await deleteFlag(flag.id);
      setFlags((prev) => prev.filter((f) => f.id !== flag.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete flag");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="container">
      <div className="card stack-gap">
        <h2>Create a flag</h2>
        {createError && <div className="error">{createError}</div>}
        <form className="row" onSubmit={handleCreate}>
          <div className="field">
            <label htmlFor="feature_key">Feature key</label>
            <input
              id="feature_key"
              type="text"
              placeholder="e.g. new_dashboard"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
            />
          </div>
          <div className="checkbox-row" style={{ paddingBottom: 9 }}>
            <input
              id="enabled"
              type="checkbox"
              checked={newEnabled}
              onChange={(e) => setNewEnabled(e.target.checked)}
            />
            <label htmlFor="enabled">Enabled</label>
          </div>
          <button type="submit" disabled={creating}>
            {creating ? "Creating…" : "Create flag"}
          </button>
        </form>
      </div>

      <div className="card">
        <h2>Flags</h2>
        {error && <div className="error">{error}</div>}
        {loading ? (
          <p className="empty">Loading flags…</p>
        ) : flags.length === 0 ? (
          <p className="empty">No flags yet. Create one above.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Feature key</th>
                <th>Status</th>
                <th>Updated</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((flag) => (
                <tr key={flag.id}>
                  <td>
                    <code>{flag.feature_key}</code>
                  </td>
                  <td>
                    <span className={`badge ${flag.enabled ? "on" : "off"}`}>
                      {flag.enabled ? "Enabled" : "Disabled"}
                    </span>
                  </td>
                  <td className="muted">{formatDate(flag.updated_at)}</td>
                  <td style={{ textAlign: "right" }}>
                    <div
                      className="actions"
                      style={{ justifyContent: "flex-end" }}
                    >
                      <button
                        className="secondary small"
                        onClick={() => handleToggle(flag)}
                        disabled={busyId === flag.id}
                      >
                        {flag.enabled ? "Disable" : "Enable"}
                      </button>
                      <button
                        className="danger small"
                        onClick={() => handleDelete(flag)}
                        disabled={busyId === flag.id}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
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
