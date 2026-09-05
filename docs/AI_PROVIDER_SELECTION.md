# AI Provider Selection

## Decision

Eko uses **Qwen3-4B through Ollama** as the preferred local provider for development, Demo Mode, and deployments that provide a private Ollama service. The backend talks to Ollama only through `OLLAMA_BASE_URL`; the frontend and Android app never receive model credentials.

When Ollama is unavailable, the backend uses the deterministic database-grounded provider. That mode is reported as a fallback, not as live AI. Gemini remains an explicit optional adapter with `AI_PROVIDER=gemini` and a server-side `GEMINI_API_KEY`.

## Why Qwen3-4B

- The official Qwen3 model card documents support for 100+ languages, which is appropriate for English, Hindi, and Hinglish inputs.
- The model card documents instruction following, reasoning, structured interaction, and agent capabilities relevant to partner operations.
- Qwen3-4B is Apache-2.0 licensed and can run locally through Ollama, llama.cpp, or other documented runtimes.
- Ollama lists a roughly 2.5 GB Qwen3-4B package. Qwen3-1.7B is a smaller Apache-2.0 alternative for constrained machines.
- Local inference keeps operational context inside the operator-controlled runtime and has no third-party API quota or per-request provider billing. It remains limited by local CPU/GPU/RAM capacity.

## Alternatives Considered

| Option | Strengths | Limits for Eko |
| --- | --- | --- |
| Qwen3-4B + Ollama | Local, multilingual, Apache-2.0, no hosted quota, documented Windows/Linux/macOS workflow | Requires Ollama and roughly multi-GB local model resources; production needs a private model service |
| Qwen3-1.7B + Ollama | Smaller local footprint and same multilingual family | Lower reasoning headroom for complex operational summaries |
| Gemini 2.5 Flash | Strong hosted quality and structured output support | API key required; official docs define RPM/TPM/RPD and spend-tier limits; data leaves the Eko runtime |
| Hosted inference providers | Simple deployment and broad model choice | Provider-specific quotas, privacy/compliance review, and external data transfer |

## Configuration

Local model:

```text
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:4b
```

Run locally with Ollama:

```text
ollama run qwen3:4b
```

Optional hosted Gemini is never selected implicitly:

```text
AI_PROVIDER=gemini
GEMINI_API_KEY=<server-side deployment secret>
GEMINI_MODEL=gemini-2.5-flash
```

Never place provider keys in frontend files, Android assets, local storage, screenshots, or logs. Rotate deployment secrets without source changes.

## Official References

- Qwen3 model card: https://huggingface.co/Qwen/Qwen3-4B
- Qwen local runtime documentation: https://qwen.readthedocs.io/en/latest/run_locally/ollama.html
- Ollama Qwen3 model sizes: https://ollama.com/library/qwen3
- Ollama generate API: https://docs.ollama.com/api/generate
- Gemini models: https://ai.google.dev/gemini-api/docs/models/gemini
- Gemini rate limits: https://ai.google.dev/gemini-api/docs/rate-limits
