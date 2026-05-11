import webpush from "web-push"
import { prisma } from "./prisma"

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:budget@venstein.ch"

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
}

export type PushPayload = {
  title: string
  body: string
  url?: string
  tag?: string
  icon?: string
}

export type NotificationType =
  | "budgetWarning"
  | "creditCardDue"
  | "partnerBooking"
  | "turnNudge"
  | "goalReached"
  | "scanReminder"
  | "weeklySummary"

export async function sendPush(userId: string, type: NotificationType, payload: PushPayload) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return

  const [subs, prefs] = await Promise.all([
    prisma.pushSubscription.findMany({ where: { userId } }),
    prisma.notificationPrefs.findUnique({ where: { userId } }),
  ])

  if (prefs && prefs[type] === false) return
  if (subs.length === 0) return

  const data = JSON.stringify(payload)
  await Promise.all(subs.map(async sub => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        data
      )
    } catch (err: unknown) {
      const status = (err as { statusCode?: number })?.statusCode
      if (status === 404 || status === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
      }
    }
  }))
}

export function getVapidPublicKey() {
  return VAPID_PUBLIC ?? null
}
