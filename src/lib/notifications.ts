import { prisma } from '@/lib/db'

export type NotificationType =
  | 'POSSIBLE_MATCH'
  | 'MATCH_CONFIRMED'
  | 'CLAIM_SUBMITTED'
  | 'CLAIM_APPROVED'
  | 'CLAIM_REJECTED'
  | 'ITEM_RETURNED'

export type NotificationInput = {
  userId: string
  type: NotificationType
  message: string
  /** Lets the UI open "View Match" straight away. */
  matchId?: string | null
  claimId?: string | null
  /**
   * The item the notice opens. For a possible match that is the OTHER item of
   * the pair — the counterpart is the news — and otherwise the item the notice
   * is about (claimed, returned).
   */
  itemId?: string | null
}

export async function notify(input: NotificationInput): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      message: input.message,
      matchId: input.matchId ?? null,
      claimId: input.claimId ?? null,
      itemId: input.itemId ?? null,
    },
  })
}

export async function notifyMany(inputs: NotificationInput[]): Promise<void> {
  if (inputs.length === 0) return
  await prisma.notification.createMany({
    data: inputs.map((input) => ({
      userId: input.userId,
      type: input.type,
      message: input.message,
      matchId: input.matchId ?? null,
      claimId: input.claimId ?? null,
      itemId: input.itemId ?? null,
    })),
  })
}
