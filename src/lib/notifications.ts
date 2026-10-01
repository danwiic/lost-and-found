import { prisma } from '@/lib/db'

export type NotificationType =
  | 'POSSIBLE_MATCH'
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
  /** The recipient's own item, so "My Reports" can deep-link to it. */
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
