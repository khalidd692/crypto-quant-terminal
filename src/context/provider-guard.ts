export async function withProviderTimeout<T>(
  provider: string,
  task: Promise<T>,
  timeoutMs: number,
  fallback: (reason: string) => T
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      task,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${provider}_TIMEOUT_AFTER_${timeoutMs}MS`)), timeoutMs);
      })
    ]);
  } catch (error) {
    return fallback(String(error));
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
