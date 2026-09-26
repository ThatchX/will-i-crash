# ADR 0019: Bound the AI instructor response budget

**Status:** Accepted

## Decision

Limit each AI flight instructor model step to 700 output tokens.

## Alternatives considered

- Leave the provider default output budget unbounded.
- Remove Claude from the model picker.
- Silently switch a failed Claude request to an OpenAI model.

## Rationale

The instructor is designed to give short, prioritized coaching. A 700-token step is comfortably larger than that product requirement while keeping DeepSpace's up-front provider credit reservation proportional to the answer the interface asks for.

Claude requests were reaching DeepSpace and the Anthropic integration successfully, but the full agent request could be rejected with `402 Payment Required` before generation while a small direct Claude request succeeded. Bounding the requested output makes the reservation predictable.

## Tradeoffs

Very long explanations may stop earlier, and a tool-using turn has less room per model step. The existing concise system prompt and multi-step tool loop make that acceptable for a flight instructor.

## Consequences

- Claude and OpenAI models use the same 700-token step budget in the instructor.
- The selected model remains explicit; the app does not silently change providers.
- Longer educational material should live outside the instructor chat rather than expanding its response budget.
