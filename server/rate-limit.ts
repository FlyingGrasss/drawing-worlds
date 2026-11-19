export const RATE_LIMIT_BURST = 120;
export const RATE_LIMIT_REFILL_PER_SECOND = 50;

/**
 * Classic token bucket. One bucket is owned by each WebSocket connection.
 */
export class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly capacity: number = RATE_LIMIT_BURST,
    private readonly refillPerSecond: number = RATE_LIMIT_REFILL_PER_SECOND,
    now: number = Date.now(),
  ) {
    this.tokens = capacity;
    this.lastRefill = now;
  }

  take(cost = 1, now: number = Date.now()): boolean {
    this.refill(now);
    if (this.tokens < cost) return false;
    this.tokens -= cost;
    return true;
  }

  retryAfterMs(cost = 1, now: number = Date.now()): number {
    this.refill(now);
    const missing = Math.max(0, cost - this.tokens);
    if (missing === 0) return 0;
    return Math.ceil((missing / this.refillPerSecond) * 1000);
  }

  get availableTokens(): number {
    return this.tokens;
  }

  private refill(now: number): void {
    const elapsedSeconds = Math.max(0, now - this.lastRefill) / 1000;
    if (elapsedSeconds === 0) return;
    this.tokens = Math.min(this.capacity, this.tokens + elapsedSeconds * this.refillPerSecond);
    this.lastRefill = now;
  }
}
