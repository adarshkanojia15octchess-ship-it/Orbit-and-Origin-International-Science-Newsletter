let lastRequestAt = 0;
let queue = Promise.resolve();

export async function waitForArxivSlot(): Promise<void> {
  const next = queue.then(async () => {
    const delay = Math.max(0, 3000 - (Date.now() - lastRequestAt));
    if (delay > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
    }
    lastRequestAt = Date.now();
  });
  queue = next.then(() => undefined, () => undefined);
  await next;
}
