// Resilient data-fetch helpers.
//
// Pub WiFi is unreliable: requests can stall indefinitely or reject. Without a
// timeout + retry, a single stalled request leaves a page stuck on its loading
// skeleton forever (the "blank space until I refresh" problem). These helpers
// guarantee a request either resolves, retries, or fails fast — never hangs.

interface RetryOptions {
  retries?: number
  timeoutMs?: number
  backoffMs?: number
}

// Races a thenable against a timeout. Supabase query builders are thenables,
// so we wrap with Promise.resolve before attaching handlers.
export function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('Request timed out')), ms)
    Promise.resolve(promise).then(
      (value) => { clearTimeout(id); resolve(value) },
      (err) => { clearTimeout(id); reject(err) },
    )
  })
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Runs a query factory with a timeout and exponential-ish backoff retries.
// `run` must re-create the query each call (Supabase builders are single-use).
export async function retryQuery<T>(
  run: () => PromiseLike<T>,
  { retries = 2, timeoutMs = 7000, backoffMs = 400 }: RetryOptions = {},
): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await withTimeout(run(), timeoutMs)
    } catch (err) {
      lastErr = err
      if (attempt < retries) await sleep(backoffMs * (attempt + 1))
    }
  }
  throw lastErr
}
