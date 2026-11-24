export type GoSpellErrorCode =
  | "startup-failed"
  | "startup-timeout"
  | "invalid-handshake"
  | "incompatible-api"
  | "service-exited"
  | "cancelled"
  | "request-failed"
  | "invalid-response"
  | "model-prepare-failed"
  | "shutdown-failed"

export class GoSpellError extends Error {
  readonly code: GoSpellErrorCode
  readonly status: number | undefined
  readonly remoteCode: string | undefined
  override readonly cause: unknown

  constructor(
    code: GoSpellErrorCode,
    message: string,
    options?: {
      readonly cause?: unknown
      readonly status?: number
      readonly remoteCode?: string
    },
  ) {
    super(message)
    this.name = "GoSpellError"
    this.code = code
    this.status = options?.status
    this.remoteCode = options?.remoteCode
    this.cause = options?.cause
  }
}

export const isGoSpellError = (value: unknown): value is GoSpellError => value instanceof GoSpellError
