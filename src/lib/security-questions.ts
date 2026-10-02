/**
 * Account recovery by security questions.
 *
 * There is no mail provider in this project, so a reset link cannot be sent.
 * The questions are the self-service path: three prompts per account, answered
 * with strings only the owner should know. Answers are treated exactly like
 * passwords — bcrypt hashes of a normalised string, never stored or echoed back
 * in readable form.
 *
 * This is a weak recovery factor by nature, and it is acceptable here for one
 * reason: a reset grants access to an account's *view*, never to an item. Any
 * claim a reset account files is still verified by a person, so the worst a
 * wrong reset buys is a look at someone's report history.
 */

/** One hashed answer per question; three are required to make guessing costly. */
export const RECOVERY_QUESTION_COUNT = 3

/** Wrong answers allowed in a row before the questions lock. */
export const RECOVERY_MAX_ATTEMPTS = 5

/** How long the lock lasts once the attempts are exhausted. */
export const RECOVERY_LOCK_MINUTES = 15

/** Answer bounds after normalisation (trim, lowercase, collapse whitespace). */
export const RECOVERY_ANSWER_MIN = 2
export const RECOVERY_ANSWER_MAX = 120

/**
 * The fixed catalog. Keys are stable identifiers stored on each row; prompts
 * are what people read. Anything with a pooled answer ("What is your
 * nationality?", "What is your favourite colour?") is deliberately excluded —
 * a question a classmate can answer is worse than no question at all.
 */
export const RECOVERY_QUESTIONS = [
  { key: 'childhood_street', prompt: 'What street did you grow up on?' },
  { key: 'first_school', prompt: 'What was the name of your first school?' },
  { key: 'childhood_nickname', prompt: 'What was your childhood nickname?' },
  { key: 'first_pet', prompt: 'What was the name of your first pet?' },
  { key: 'mother_maiden_name', prompt: "What is your mother's maiden name?" },
  { key: 'first_job', prompt: 'Where did you work in your very first job?' },
  { key: 'favourite_teacher', prompt: 'Who was your favourite teacher in grade school?' },
  { key: 'memorable_meal', prompt: 'What is a dish your family cooks that nobody else does?' },
] as const

export type RecoveryQuestionKey = (typeof RECOVERY_QUESTIONS)[number]['key']

const BY_KEY = new Map(RECOVERY_QUESTIONS.map((question) => [question.key, question]))

export function isRecoveryQuestionKey(value: unknown): value is RecoveryQuestionKey {
  return typeof value === 'string' && BY_KEY.has(value as RecoveryQuestionKey)
}

/** The prompt for a stored key, or a safe placeholder if the key is unknown. */
export function recoveryPrompt(key: string): string {
  return BY_KEY.get(key as RecoveryQuestionKey)?.prompt ?? 'Security question'
}

/** The one message used whenever the questions are locked, so it stays true. */
export function recoveryLockMessage(): string {
  return `Too many wrong answers. Try again in ${RECOVERY_LOCK_MINUTES} minutes.`
}

/**
 * Answer comparison cannot depend on typing style: casing, padding and doubled
 * spaces are folded away before hashing and before verifying, so "Balagtas"
 * and "  balagtas " are the same answer. Nothing else is simplified — the words
 * themselves still have to match.
 */
export function normalizeAnswer(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}
