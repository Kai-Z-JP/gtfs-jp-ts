export class AsyncQueue<T> {
  #items: T[] = [];
  #waiters: Array<{
    resolve: (value: T | undefined) => void;
    reject: (reason?: unknown) => void;
  }> = [];
  #closed = false;
  #failed = false;
  #failureReason: unknown;

  push(item: T): void {
    if (this.#closed) {
      throw new Error('Queue is closed');
    }

    const waiter = this.#waiters.shift();
    if (waiter) {
      waiter.resolve(item);
      return;
    }

    this.#items.push(item);
  }

  close(): void {
    if (this.#closed) {
      return;
    }

    this.#closed = true;
    for (const waiter of this.#waiters) {
      waiter.resolve(undefined);
    }
    this.#waiters = [];
  }

  fail(reason: unknown): void {
    if (this.#closed) {
      return;
    }

    this.#closed = true;
    this.#failed = true;
    this.#failureReason = reason;
    this.#items = [];
    for (const waiter of this.#waiters) {
      waiter.reject(reason);
    }
    this.#waiters = [];
  }

  async shift(): Promise<T | undefined> {
    if (this.#items.length > 0) {
      return this.#items.shift();
    }

    if (this.#failed) {
      throw this.#failureReason;
    }

    if (this.#closed) {
      return undefined;
    }

    return await new Promise<T | undefined>((resolve, reject) => {
      this.#waiters.push({ resolve, reject });
    });
  }
}
