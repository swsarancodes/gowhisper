import { GoSpellError } from "./errors.js"
import { consumeSse } from "./sse.js"
import {
  decodeCapabilities,
  decodeDictationLevel,
  decodeDictationStart,
  decodeHealth,
  decodeModels,
  decodeProgress,
  decodeTranscription,
  type EmbeddedEndpoint,
} from "./protocol.js"
import type {
  GoSpellClient,
  DictationLevel,
  ListModelsOptions,
  ModelId,
  PrepareModelOptions,
  RequestOptions,
  TranscriptionRequest,
  TranscriptionResult,
} from "./types.js"

interface ResponseContext {
  readonly response: Response
  readonly signal: AbortSignal
}

const abortError = (signal: AbortSignal): GoSpellError => {
  if (signal.reason instanceof GoSpellError) return signal.reason
  return new GoSpellError("cancelled", "GOSPELL operation was cancelled", { cause: signal.reason })
}

const boundaryError = (
  cause: unknown,
  signal: AbortSignal,
  code: "request-failed" | "invalid-response",
  message: string,
): GoSpellError => {
  if (cause instanceof GoSpellError) return cause
  if (signal.aborted) return abortError(signal)
  return new GoSpellError(code, message, { cause })
}

const rejection = async (
  response: Response,
  signal: AbortSignal,
): Promise<{ readonly message: string; readonly remoteCode?: string }> => {
  try {
    const body: unknown = await response.json()
    if (typeof body === "object" && body !== null && "code" in body && typeof body.code === "string") {
      return { message: body.code, remoteCode: body.code }
    }
  } catch (cause) {
    if (signal.aborted) throw abortError(signal)
    if (cause instanceof GoSpellError) throw cause
  }
  return { message: `HTTP ${response.status}` }
}

const json = async ({ response, signal }: ResponseContext): Promise<unknown> => {
  try {
    return await response.json()
  } catch (cause) {
    throw boundaryError(cause, signal, "invalid-response", "GOSPELL returned malformed JSON")
  }
}

const combineSignals = (first: AbortSignal, second?: AbortSignal): AbortSignal => {
  if (second === undefined) return first
  if (first.aborted) return first
  if (second.aborted) return second
  return AbortSignal.any([first, second])
}

const languageSuffix = (language?: string): string =>
  language === undefined ? "" : `?${new URLSearchParams({ language })}`

export const makeClient = (
  endpoint: EmbeddedEndpoint,
  transport: typeof globalThis.fetch,
  lifetime: AbortSignal,
): GoSpellClient => {
  const request = async (
    path: string,
    init: RequestInit = {},
    callerSignal?: AbortSignal,
  ): Promise<ResponseContext> => {
    const signal = combineSignals(lifetime, callerSignal)
    const headers = new Headers(init.headers)
    headers.set("authorization", `Bearer ${endpoint.token}`)
    let response: Response
    try {
      response = await transport(`${endpoint.url}${path}`, {
        ...init,
        headers,
        signal,
      })
    } catch (cause) {
      throw boundaryError(cause, signal, "request-failed", "Could not reach the embedded GOSPELL service")
    }
    if (!response.ok) {
      const remote = await rejection(response, signal)
      throw new GoSpellError("request-failed", `GOSPELL rejected the request: ${remote.message}`, {
        status: response.status,
        ...(remote.remoteCode === undefined ? {} : { remoteCode: remote.remoteCode }),
      })
    }
    return { response, signal }
  }

  const health = async (options?: RequestOptions) =>
    decodeHealth(await json(await request("/health", {}, options?.signal)))

  const capabilities = async (options?: RequestOptions) =>
    decodeCapabilities(await json(await request("/capabilities", {}, options?.signal)))

  const list = async (options?: ListModelsOptions) =>
    decodeModels(await json(await request(`/models${languageSuffix(options?.language)}`, {}, options?.signal)))

  const prepare = async (id: ModelId, options?: PrepareModelOptions): Promise<void> => {
    const context = await request(
      `/models/${id}/prepare${languageSuffix(options?.language)}`,
      { method: "POST" },
      options?.signal,
    )
    const { response, signal } = context
    let completed = false
    const dispatch = (data: string) => {
      let value: unknown
      try {
        value = JSON.parse(data)
      } catch (cause) {
        throw new GoSpellError("invalid-response", "GOSPELL returned malformed model progress", { cause })
      }
      const progress = decodeProgress(value)
      if (progress === "ok") {
        completed = true
        return true
      }
      try {
        options?.onProgress?.(progress)
      } catch (cause) {
        throw new GoSpellError("request-failed", "The model progress callback failed", { cause })
      }
      if (signal.aborted) throw abortError(signal)
    }

    try {
      await consumeSse(response, signal, "model progress", dispatch)
    } catch (cause) {
      throw boundaryError(cause, signal, "invalid-response", "GOSPELL model progress stream failed")
    }
    if (!completed) throw new GoSpellError("model-prepare-failed", "GOSPELL model preparation ended without a result")
  }

  const transcribe = async (input: TranscriptionRequest) => {
    const query = new URLSearchParams({ model: input.model })
    if (input.language !== undefined) query.set("language", input.language)
    if (input.process !== undefined) query.set("process", input.process)
    if (input.timestamps !== undefined && input.timestamps !== "none") {
      query.set("timestamps", input.timestamps)
    }
    let body: ArrayBuffer
    if (input.audio.data instanceof ArrayBuffer) {
      body = input.audio.data
    } else if (
      input.audio.data.buffer instanceof ArrayBuffer
      && input.audio.data.byteOffset === 0
      && input.audio.data.byteLength === input.audio.data.buffer.byteLength
    ) {
      body = input.audio.data.buffer
    } else {
      const copy = new Uint8Array(input.audio.data.byteLength)
      copy.set(input.audio.data)
      body = copy.buffer
    }
    const response = await request(`/transcriptions?${query}`, {
      method: "POST",
      headers: { "content-type": input.audio.contentType },
      body,
    }, input.signal)
    return decodeTranscription(await json(response))
  }

  const boundedStream = <A>(
    bufferSize: number,
    failureMessage: string,
    consume: (push: (value: A) => void, signal: AbortSignal) => Promise<void>,
  ): AsyncIterable<A> => {
    const values: Array<A> = []
    const controller = new AbortController()
    let pending: {
      resolve: (result: IteratorResult<A>) => void
      reject: (error: unknown) => void
    } | undefined
    let iterated = false
    let ended = false
    let stopped = false
    let failure: unknown
    let running: Promise<void> | undefined
    const finish = (error?: unknown) => {
      if (ended) return
      ended = true
      failure = error
      const waiter = pending
      pending = undefined
      if (waiter !== undefined) {
        if (error === undefined) waiter.resolve({ value: undefined, done: true })
        else waiter.reject(error)
      }
    }
    const push = (value: A) => {
      if (stopped || ended) return
      if (pending !== undefined) {
        const waiter = pending
        pending = undefined
        waiter.resolve({ value, done: false })
        return
      }
      if (values.length >= bufferSize) values.shift()
      values.push(value)
    }
    const start = () => {
      running ??= consume(push, controller.signal).then(
        () => finish(),
        (cause) => finish(stopped ? undefined : boundaryError(
          cause,
          combineSignals(lifetime, controller.signal),
          "invalid-response",
          failureMessage,
        )),
      )
    }
    return {
      [Symbol.asyncIterator]: () => {
        if (iterated) throw new GoSpellError("request-failed", "GOSPELL observation streams support one consumer")
        iterated = true
        start()
        return {
          next: async () => {
            const value = values.shift()
            if (value !== undefined) return { value, done: false }
            if (failure !== undefined) throw failure
            if (ended) return { value: undefined, done: true }
            if (pending !== undefined) {
              throw new GoSpellError("request-failed", "Concurrent stream reads are not supported")
            }
            return new Promise<IteratorResult<A>>((resolve, reject) => {
              pending = { resolve, reject }
            })
          },
          return: async () => {
            stopped = true
            values.length = 0
            controller.abort("iterator closed")
            finish()
            await running
            return { value: undefined, done: true }
          },
        }
      },
    }
  }

  const dictationHeaders = (ownerToken: string) => ({ "x-gospell-dictation-token": ownerToken })

  const levelStream = (id: number, ownerToken: string): AsyncIterable<DictationLevel> =>
    boundedStream(32, "GOSPELL dictation level stream failed", async (push, streamSignal) => {
      const { response, signal } = await request(
        `/dictations/${id}/levels`,
        { headers: dictationHeaders(ownerToken) },
        streamSignal,
      )
      await consumeSse(response, signal, "dictation level", (data) => {
        if (data !== "") push(decodeDictationLevel(JSON.parse(data)))
      })
    })

  const audioStream = (id: number, ownerToken: string): AsyncIterable<Float32Array> =>
    boundedStream(8, "GOSPELL dictation audio stream failed", async (push, streamSignal) => {
      const { response, signal } = await request(
        `/dictations/${id}/audio`,
        { headers: dictationHeaders(ownerToken) },
        streamSignal,
      )
      if (!response.headers.get("content-type")?.toLowerCase().startsWith("application/octet-stream")) {
        throw new GoSpellError("invalid-response", "GOSPELL returned an invalid dictation audio content type")
      }
      if (response.body === null) throw new GoSpellError("invalid-response", "GOSPELL returned no dictation audio stream")
      const reader = response.body.getReader()
      let pending = new Uint8Array(0)
      try {
        while (true) {
          const chunk = await reader.read()
          if (chunk.done) break
          if (signal.aborted) throw abortError(signal)
          const bytes = new Uint8Array(pending.length + chunk.value.length)
          bytes.set(pending)
          bytes.set(chunk.value, pending.length)
          const sampleBytes = bytes.length - bytes.length % 4
          if (sampleBytes > 0) {
            const view = new DataView(bytes.buffer, bytes.byteOffset, sampleBytes)
            const samples = new Float32Array(sampleBytes / 4)
            for (let index = 0; index < samples.length; index++) {
              samples[index] = view.getFloat32(index * 4, true)
            }
            push(samples)
          }
          pending = bytes.slice(sampleBytes)
        }
        if (pending.length !== 0) {
          throw new GoSpellError("invalid-response", "GOSPELL returned an incomplete Float32 audio sample")
        }
      } finally {
        if (signal.aborted) await reader.cancel(signal.reason).catch(() => {})
        reader.releaseLock()
      }
    })

  const startDictation = async (options: { readonly source: string }) => {
    const { id, ownerToken, sampleRate } = decodeDictationStart(await json(await request("/dictations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: options.source }),
    })))
    const levels = levelStream(id, ownerToken)
    const audio = audioStream(id, ownerToken)
    const headers = dictationHeaders(ownerToken)
    let finished: TranscriptionResult | undefined
    let cancelled = false
    let finishInFlight: Promise<TranscriptionResult> | undefined
    let cancelInFlight: Promise<void> | undefined
    const heartbeat = setInterval(() => {
      void request(`/dictations/${id}/heartbeat`, { method: "POST", headers }).catch(stopHeartbeatOnTerminalError)
    }, 3_000)
    const stopHeartbeat = () => {
      clearInterval(heartbeat)
      lifetime.removeEventListener("abort", stopHeartbeat)
    }
    const stopHeartbeatOnTerminalError = (error: unknown) => {
      // These responses cannot renew this capture; transport and server failures can be retried.
      if (error instanceof GoSpellError && (error.status === 401 || error.status === 404 || error.status === 409)) {
        stopHeartbeat()
      }
    }
    lifetime.addEventListener("abort", stopHeartbeat, { once: true })
    if (lifetime.aborted) stopHeartbeat()
    return {
      id,
      ownerToken,
      sampleRate,
      levels,
      audio,
      finish: () => {
        if (finished !== undefined) return Promise.resolve(finished)
        if (cancelled) return Promise.reject(new GoSpellError("request-failed", "GOSPELL dictation was cancelled"))
        finishInFlight ??= (async () => {
          const result = decodeTranscription(await json(await request(
            `/dictations/${id}/finish`,
            { method: "POST", headers },
          )))
          finished = result
          stopHeartbeat()
          return result
        })().catch((error: unknown) => {
          stopHeartbeatOnTerminalError(error)
          throw error
        }).finally(() => {
          finishInFlight = undefined
        })
        return finishInFlight
      },
      cancel: () => {
        if (cancelled || finished !== undefined) return Promise.resolve()
        cancelInFlight ??= request(
          `/dictations/${id}/cancel`,
          { method: "POST", headers },
        ).then(() => {
          cancelled = true
          stopHeartbeat()
        }).catch((error: unknown) => {
          stopHeartbeatOnTerminalError(error)
          throw error
        }).finally(() => {
          cancelInFlight = undefined
        })
        return cancelInFlight
      },
    }
  }

  return { health, capabilities, models: { list, prepare }, transcribe, dictation: { start: startDictation } }
}
