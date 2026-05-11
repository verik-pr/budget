"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Bell, BellOff } from "lucide-react"
import { useToast } from "@/components/toast"
import { Skeleton } from "@/components/skeleton"

type Prefs = {
  budgetWarning: boolean
  creditCardDue: boolean
  partnerBooking: boolean
  turnNudge: boolean
  goalReached: boolean
  scanReminder: boolean
  weeklySummary: boolean
}

const FLAG_LABELS: { key: keyof Prefs; label: string; desc: string }[] = [
  { key: "budgetWarning", label: "Budget-Warnung", desc: "Bei 80% und 100% einer Kategorie" },
  { key: "creditCardDue", label: "Kreditkarte fällig", desc: "3 Tage vor Fälligkeit" },
  { key: "partnerBooking", label: "Partner-Buchung", desc: "Wenn dein Partner etwas geteilt einkauft" },
  { key: "turnNudge", label: "Du bist dran", desc: "Wenn Auslagen-Differenz > CHF 100 ist" },
  { key: "goalReached", label: "Sparziel erreicht", desc: "Wenn ein Ziel zu 100% gefüllt ist" },
  { key: "scanReminder", label: "Scan-Erinnerung", desc: "Wenn du 3 Tage nichts gebucht hast" },
  { key: "weeklySummary", label: "Wochen-Rückblick", desc: "KI-Zusammenfassung sonntagabends" },
]

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - base64.length % 4) % 4)
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(b64)
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

export default function NotificationsPage() {
  const router = useRouter()
  const toast = useToast()
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default")
  const [subscribed, setSubscribed] = useState(false)
  const [prefs, setPrefs] = useState<Prefs | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPermission("unsupported")
      setLoading(false)
      return
    }
    setPermission(Notification.permission)

    navigator.serviceWorker.getRegistration("/sw.js").then(async reg => {
      const sub = reg ? await reg.pushManager.getSubscription() : null
      setSubscribed(!!sub)
    })

    fetch("/api/notification-prefs").then(r => r.json()).then((p: Prefs) => {
      setPrefs(p)
      setLoading(false)
    })
  }, [])

  async function enable() {
    if (permission === "unsupported") return
    setBusy(true)
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== "granted") {
        toast("Berechtigung verweigert", "error")
        setBusy(false)
        return
      }

      const reg = await navigator.serviceWorker.register("/sw.js")
      await navigator.serviceWorker.ready

      const keyRes = await fetch("/api/push/subscribe")
      const { publicKey } = await keyRes.json()
      if (!publicKey) throw new Error("VAPID Key fehlt")

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      const json = sub.toJSON()
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      })
      if (!res.ok) throw new Error()

      setSubscribed(true)
      toast("Notifications aktiviert")
    } catch {
      toast("Konnte nicht aktivieren", "error")
    }
    setBusy(false)
  }

  async function disable() {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js")
      const sub = reg ? await reg.pushManager.getSubscription() : null
      if (sub) {
        const endpoint = sub.endpoint
        await sub.unsubscribe()
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        })
      }
      setSubscribed(false)
      toast("Notifications deaktiviert")
    } catch {
      toast("Fehler beim Deaktivieren", "error")
    }
    setBusy(false)
  }

  async function togglePref(key: keyof Prefs) {
    if (!prefs) return
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    try {
      const res = await fetch("/api/notification-prefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: next[key] }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setPrefs(prefs)
      toast("Konnte nicht speichern", "error")
    }
  }

  async function sendTest() {
    setBusy(true)
    try {
      const res = await fetch("/api/push/test", { method: "POST" })
      if (!res.ok) throw new Error()
      toast("Test gesendet")
    } catch {
      toast("Test fehlgeschlagen", "error")
    }
    setBusy(false)
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-black px-6 pt-safe pb-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-zinc-500 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <p className="text-zinc-500 text-xs font-semibold tracking-widest uppercase">Notifications</p>
        </div>
      </div>

      <div className="px-6 pt-4 pb-8 space-y-4">
        {permission === "unsupported" ? (
          <div className="bg-zinc-900 rounded-2xl p-5 text-center">
            <BellOff className="w-8 h-8 text-zinc-500 mx-auto mb-3" />
            <p className="text-white text-sm font-bold mb-1">Nicht unterstützt</p>
            <p className="text-zinc-500 text-xs">Dein Browser unterstützt keine Push-Notifications. Auf iOS musst du die App über „Zum Home-Bildschirm" installieren.</p>
          </div>
        ) : (
          <>
            <div className="bg-zinc-900 rounded-2xl p-5">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: subscribed ? "#22c55e20" : "#71717a20" }}>
                  {subscribed
                    ? <Bell className="w-5 h-5 text-green-500" />
                    : <BellOff className="w-5 h-5 text-zinc-400" />}
                </div>
                <div className="flex-1">
                  <p className="text-white text-sm font-bold">
                    {subscribed ? "Notifications aktiv" : "Notifications nicht aktiv"}
                  </p>
                  <p className="text-zinc-500 text-xs mt-0.5">
                    {permission === "denied"
                      ? "Berechtigung verweigert · in Einstellungen freigeben"
                      : subscribed ? "Du bekommst Push-Nachrichten" : "Tippe Aktivieren um Push zu erlauben"}
                  </p>
                </div>
              </div>
              {subscribed ? (
                <div className="flex gap-2">
                  <button onClick={sendTest} disabled={busy}
                    className="flex-1 bg-zinc-800 text-zinc-300 rounded-xl py-2.5 text-sm font-bold active:opacity-70 disabled:opacity-30">
                    Test
                  </button>
                  <button onClick={disable} disabled={busy}
                    className="flex-1 bg-zinc-800 text-zinc-300 rounded-xl py-2.5 text-sm font-bold active:opacity-70 disabled:opacity-30">
                    Deaktivieren
                  </button>
                </div>
              ) : (
                <button onClick={enable} disabled={busy || permission === "denied"}
                  className="w-full bg-green-500 text-black rounded-xl py-2.5 text-sm font-bold active:opacity-70 disabled:opacity-30">
                  {busy ? "…" : "Aktivieren"}
                </button>
              )}
            </div>

            <div>
              <p className="text-zinc-600 text-xs font-semibold uppercase tracking-widest mb-3 px-1">Welche Notifications</p>
              {loading ? (
                <div className="bg-white rounded-3xl p-4 space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} light className="h-10 w-full" />)}
                </div>
              ) : prefs && (
                <div className="bg-white rounded-3xl overflow-hidden">
                  {FLAG_LABELS.map((flag, i) => (
                    <button key={flag.key} onClick={() => togglePref(flag.key)}
                      className={`w-full flex items-center gap-4 px-5 py-4 text-left active:bg-gray-50 ${i < FLAG_LABELS.length - 1 ? "border-b border-gray-100" : ""}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{flag.label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{flag.desc}</p>
                      </div>
                      <div className={`w-11 h-7 rounded-full p-0.5 transition-colors flex-shrink-0 ${prefs[flag.key] ? "bg-green-500" : "bg-gray-200"}`}>
                        <div className={`w-6 h-6 bg-white rounded-full shadow transition-transform ${prefs[flag.key] ? "translate-x-4" : ""}`} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <p className="text-zinc-700 text-xs mt-3 px-1">Auch wenn Notifications aktiv sind, kommen nur Nachrichten für aktivierte Typen an.</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
