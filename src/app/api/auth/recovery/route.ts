import type { NextRequest } from 'next/server'
import { badRequest, handleRoute, json, readBody } from '@/lib/api'
import { hashPassword, requireUser, verifyPassword } from '@/lib/auth'
import { prisma } from '@/lib/db'
import {
  isRecoveryQuestionKey,
  normalizeAnswer,
  RECOVERY_ANSWER_MAX,
  RECOVERY_ANSWER_MIN,
  RECOVERY_QUESTION_COUNT,
  recoveryPrompt,
} from '@/lib/security-questions'
import { ValidationError } from '@/lib/validation'

export const dynamic = 'force-dynamic'

type AnswerInput = { questionKey: string; answer: string }

/**
 * Validates the three question/answer pairs. Field errors are keyed by question
 * so each row of the form can show its own message; set-level problems (wrong
 * count, duplicate question) come back under `answers`.
 */
function parseAnswers(raw: unknown): AnswerInput[] {
  if (!Array.isArray(raw)) {
    throw new ValidationError({ answers: 'Answer each of the three questions.' })
  }

  const fields: Record<string, string> = {}
  const seen = new Set<string>()
  const answers: AnswerInput[] = []

  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue
    const { questionKey, answer } = entry as { questionKey?: unknown; answer?: unknown }
    if (!isRecoveryQuestionKey(questionKey) || seen.has(questionKey)) {
      throw new ValidationError({ answers: 'Choose three different questions from the list.' })
    }
    seen.add(questionKey)

    const clean = normalizeAnswer(typeof answer === 'string' ? answer : '')
    if (clean.length < RECOVERY_ANSWER_MIN) {
      fields[questionKey] = 'Please answer this question.'
    } else if (clean.length > RECOVERY_ANSWER_MAX) {
      fields[questionKey] = `Keep the answer under ${RECOVERY_ANSWER_MAX} characters.`
    }
    answers.push({ questionKey, answer: clean })
  }

  if (answers.length !== RECOVERY_QUESTION_COUNT) {
    throw new ValidationError({ answers: `Choose exactly ${RECOVERY_QUESTION_COUNT} questions.` })
  }
  if (Object.keys(fields).length > 0) throw new ValidationError(fields)

  return answers
}

/**
 * PATCH /api/auth/recovery — sets or replaces the signed-in user's recovery
 * questions, or hides the setup prompt.
 *
 * Setting them always requires the current password. Without that check a
 * hijacked session could quietly replace the questions and lock the owner out
 * of the one route that gets them back in.
 */
export async function PATCH(request: NextRequest) {
  return handleRoute(async () => {
    const user = await requireUser(request)
    const body = await readBody(request)
    const action = typeof body.action === 'string' ? body.action : 'SET'

    if (action === 'HIDE_PROMPT') {
      await prisma.user.update({
        where: { id: user.id },
        data: { recoveryPromptHiddenAt: new Date() },
      })
      return json({ ok: true })
    }

    if (action !== 'SET') throw badRequest('Unknown account recovery action.')

    const password = typeof body.password === 'string' ? body.password : ''
    if (!password) throw new ValidationError({ password: 'Enter your current password.' })

    const account = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    })
    if (!account) throw badRequest('That account is no longer available.')
    if (!(await verifyPassword(password, account.passwordHash))) {
      throw new ValidationError({ password: 'That password is not correct.' })
    }

    const answers = parseAnswers(body.answers)
    // Hash each answer before touching the table, so a failure part-way cannot
    // leave a half-replaced set behind.
    const hashes = await Promise.all(answers.map((entry) => hashPassword(entry.answer)))

    await prisma.$transaction([
      prisma.securityAnswer.deleteMany({ where: { userId: user.id } }),
      prisma.securityAnswer.createMany({
        data: answers.map((entry, index) => ({
          userId: user.id,
          questionKey: entry.questionKey,
          answerHash: hashes[index],
        })),
      }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          // Answering them fresh also clears a run of failed attempts and
          // retires the prompt, since the job it was asking for is now done.
          recoveryAttempts: 0,
          recoveryLockedUntil: null,
          recoveryPromptHiddenAt: null,
        },
      }),
    ])

    return json({
      questions: answers.map((entry) => ({
        questionKey: entry.questionKey,
        prompt: recoveryPrompt(entry.questionKey),
      })),
    })
  })
}
