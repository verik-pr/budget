self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()))

self.addEventListener("push", event => {
  if (!event.data) return
  let payload
  try { payload = event.data.json() } catch { payload = { title: "Budget", body: event.data.text() } }

  const { title = "Budget", body = "", url = "/", tag, icon = "/icon.png" } = payload

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: icon,
      tag: tag || undefined,
      data: { url },
      requireInteraction: false,
    })
  )
})

self.addEventListener("notificationclick", event => {
  event.notification.close()
  const url = event.notification.data?.url || "/"
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
    const existing = all.find(c => c.url.includes(self.location.origin))
    if (existing) {
      await existing.focus()
      if ("navigate" in existing) await existing.navigate(url).catch(() => {})
    } else {
      await self.clients.openWindow(url)
    }
  })())
})
