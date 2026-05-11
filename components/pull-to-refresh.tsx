"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { Loader2 } from "lucide-react"

const THRESHOLD = 70
const MAX_PULL = 120

export function PullToRefresh({ onRefresh, children }: { onRefresh: () => Promise<void> | void; children: ReactNode }) {
  const [distance, setDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef<number | null>(null)
  const distanceRef = useRef(0)
  const refreshingRef = useRef(false)

  useEffect(() => { distanceRef.current = distance }, [distance])
  useEffect(() => { refreshingRef.current = refreshing }, [refreshing])

  useEffect(() => {
    function start(e: TouchEvent) {
      if (window.scrollY > 0 || refreshingRef.current) return
      startY.current = e.touches[0].clientY
    }

    function move(e: TouchEvent) {
      if (startY.current === null || refreshingRef.current) return
      if (window.scrollY > 0) { startY.current = null; setDistance(0); return }
      const delta = e.touches[0].clientY - startY.current
      if (delta <= 0) { if (distanceRef.current > 0) setDistance(0); return }
      const damped = Math.min(Math.pow(delta, 0.82), MAX_PULL)
      setDistance(damped)
    }

    async function end() {
      if (startY.current === null) return
      startY.current = null
      if (distanceRef.current >= THRESHOLD && !refreshingRef.current) {
        setRefreshing(true)
        setDistance(50)
        try { await onRefresh() } finally {
          setRefreshing(false)
          setDistance(0)
        }
      } else {
        setDistance(0)
      }
    }

    window.addEventListener("touchstart", start, { passive: true })
    window.addEventListener("touchmove", move, { passive: true })
    window.addEventListener("touchend", end, { passive: true })
    window.addEventListener("touchcancel", end, { passive: true })

    return () => {
      window.removeEventListener("touchstart", start)
      window.removeEventListener("touchmove", move)
      window.removeEventListener("touchend", end)
      window.removeEventListener("touchcancel", end)
    }
  }, [onRefresh])

  const visible = distance > 4 || refreshing
  const rotation = refreshing ? 0 : distance * 4

  return (
    <>
      <div className="fixed inset-x-0 z-30 flex justify-center pointer-events-none"
        style={{
          top: `calc(env(safe-area-inset-top) + 0.5rem)`,
          transform: `translateY(${Math.max(distance - 50, -50)}px)`,
          opacity: visible ? Math.min(distance / THRESHOLD, 1) : 0,
          transition: distance === 0 && !refreshing ? "transform 200ms ease-out, opacity 200ms ease-out" : undefined,
        }}>
        <div className="bg-zinc-900 rounded-full p-2.5 shadow-xl">
          <Loader2 className={`w-4 h-4 text-white ${refreshing ? "spinner" : ""}`}
            style={!refreshing ? { transform: `rotate(${rotation}deg)`, transition: "transform 50ms linear" } : undefined} />
        </div>
      </div>
      {children}
    </>
  )
}
