import type { Effect, Scope } from "effect"
import * as GoSpell from "../src/index.js"
import * as EffectGoSpell from "../src/effect.js"

// Compile-only consumer checks: never start a helper from a type assertion.
export function createTypes(
  low: GoSpell.CreateOptions,
  ready: GoSpell.TranscriberOptions,
  ambiguous: Omit<GoSpell.CreateOptions, "model"> & { model?: GoSpell.ModelId },
) {
  const host: Promise<GoSpell.GoSpellHost> = GoSpell.create(low)
  const transcriber: Promise<GoSpell.Transcriber> = GoSpell.create(ready)
  const effectHost: Effect.Effect<EffectGoSpell.Host, EffectGoSpell.GoSpellError, Scope.Scope> = EffectGoSpell.create(low)
  const effectTranscriber: Effect.Effect<EffectGoSpell.Transcriber, EffectGoSpell.GoSpellError, Scope.Scope> = EffectGoSpell.create(ready)
  const invalid = { model: "fictional-model" }

  // @ts-expect-error A model-bound transcriber cannot masquerade as a low-level host.
  const widened: GoSpell.CreateOptions = ready
  // @ts-expect-error Optional models cannot determine which resource is returned.
  GoSpell.create(ambiguous)
  // @ts-expect-error Optional models cannot determine which resource is returned.
  EffectGoSpell.create(ambiguous)
  // @ts-expect-error Invalid model variables must not fall back to the low-level overload.
  GoSpell.create(invalid)
  // @ts-expect-error Invalid model variables must not fall back to the low-level overload.
  EffectGoSpell.create(invalid)
  // @ts-expect-error The existing service layer deliberately provides only the low-level client.
  EffectGoSpell.layer(ready)

  return { host, transcriber, effectHost, effectTranscriber, widened }
}
