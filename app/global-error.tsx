"use client"

import { useEffect } from "react"

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="de">
      <body style={{ background: "#000", color: "#fff", margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
          <div style={{ maxWidth: 400, width: "100%", background: "#18181b", borderRadius: 24, padding: "32px 24px", textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(239, 68, 68, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 28 }}>⚠️</div>
            <p style={{ fontSize: 18, fontWeight: 900, marginBottom: 4 }}>Schwerwiegender Fehler</p>
            <p style={{ fontSize: 14, color: "#71717a", marginBottom: 24 }}>{error.message || "Unerwarteter Fehler in der App."}</p>
            <button onClick={() => reset()}
              style={{ width: "100%", background: "#22c55e", color: "#000", border: 0, borderRadius: 16, padding: "12px 0", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              Neu laden
            </button>
            {error.digest && (
              <p style={{ fontSize: 11, color: "#3f3f46", marginTop: 16, fontFamily: "monospace" }}>#{error.digest}</p>
            )}
          </div>
        </div>
      </body>
    </html>
  )
}
