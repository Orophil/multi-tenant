"use client";

import { useState } from "react";
import { checkFlag, FlagCheckResult } from "@/lib/api";

export default function EndUserView() {
  const [featureKey, setFeatureKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FlagCheckResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const key = featureKey.trim();
    if (!key) {
      setError("Please enter a feature key.");
      return;
    }
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await checkFlag(key);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="card card-narrow" style={{ margin: "0 auto" }}>
        <h2>Feature Check</h2>
        <p className="subtitle">
          Enter a feature key to check whether it is enabled for your
          organization.
        </p>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="featureKey">Feature key</label>
            <input
              id="featureKey"
              type="text"
              value={featureKey}
              onChange={(e) => setFeatureKey(e.target.value)}
              placeholder="e.g. new_dashboard"
              autoComplete="off"
            />
          </div>
          <button type="submit" className="full" disabled={loading}>
            {loading ? "Checking…" : "Submit"}
          </button>
        </form>

        {result && (
          <div className={`result ${result.enabled ? "enabled" : "disabled"}`}>
            Feature &quot;{result.feature_key}&quot; is{" "}
            <span className="badge-strong">
              {result.enabled ? "ENABLED" : "DISABLED"}
            </span>{" "}
            for {result.organizationName}
          </div>
        )}
      </div>
    </div>
  );
}
