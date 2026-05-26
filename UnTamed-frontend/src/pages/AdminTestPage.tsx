import { useEffect, useState } from "react";
import { getAdminHealth, type AdminHealthResponse } from "../api/admin.api";

export default function AdminTestPage() {
  const [health, setHealth] = useState<AdminHealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    getAdminHealth()
      .then((data) => {
        if (!alive) return;
        setHealth(data);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setHealth(null);
        setError(err instanceof Error ? err.message : "Admin health check failed");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  return (
    <main style={{ minHeight: "100vh", padding: "96px 24px 32px", background: "#f5efe6" }}>
      <section
        style={{
          maxWidth: 640,
          margin: "0 auto",
          border: "1px solid rgba(19, 80, 48, 0.16)",
          borderRadius: 18,
          background: "#fffaf1",
          padding: 28,
          boxShadow: "0 18px 50px rgba(31, 45, 37, 0.12)",
        }}
      >
        <p style={{ margin: 0, color: "#f47b2a", fontWeight: 800, letterSpacing: 0.8 }}>
          ADMIN TEST
        </p>
        <h1 style={{ margin: "8px 0 12px", color: "#174b2d", fontSize: 32 }}>
          Admin access foundation
        </h1>

        {loading && <p style={{ color: "#667085" }}>Checking admin access...</p>}

        {!loading && health && (
          <div
            style={{
              border: "1px solid rgba(19, 80, 48, 0.18)",
              borderRadius: 14,
              background: "rgba(19, 80, 48, 0.08)",
              padding: 16,
              color: "#174b2d",
            }}
          >
            <strong>{health.status}</strong>
            <p style={{ margin: "6px 0 0" }}>{health.message}</p>
          </div>
        )}

        {!loading && error && (
          <div
            style={{
              border: "1px solid rgba(180, 35, 24, 0.2)",
              borderRadius: 14,
              background: "rgba(180, 35, 24, 0.08)",
              padding: 16,
              color: "#912018",
            }}
          >
            <strong>Access check failed</strong>
            <p style={{ margin: "6px 0 0" }}>{error}</p>
          </div>
        )}
      </section>
    </main>
  );
}
