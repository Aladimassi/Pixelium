import type { IntentMandate, IntentMandatePayload } from '@pixelium/shared';
import { validateIntentAgainstConditions } from '@pixelium/shared';
import {
  auditStore,
  buildCart,
  createIntentMandate,
  createPaymentMandate,
  submitPayment,
  type BrokerResult,
} from './broker.js';

export type WatchStatus = 'waiting' | 'ready' | 'executed' | 'blocked' | 'expired';

export interface DelegatedWatchJob {
  id: string;
  intentMandate: IntentMandate;
  items: Array<{ sku: string; quantity: number }>;
  status: WatchStatus;
  createdAt: string;
  executedAt?: string;
  result?: BrokerResult;
  nextCheckAt?: string;
}

const jobs = new Map<string, DelegatedWatchJob>();

function jobStatus(intent: IntentMandate, cartTotalCents?: number, skus?: string[]): WatchStatus {
  const { conditions } = intent.payload;
  if (new Date(conditions.validUntil).getTime() < Date.now()) return 'expired';
  if (conditions.validFrom && new Date(conditions.validFrom).getTime() > Date.now()) {
    return 'waiting';
  }
  if (cartTotalCents != null && skus) {
    const check = validateIntentAgainstConditions(intent, cartTotalCents, skus);
    if (!check.valid) return 'blocked';
  }
  return 'ready';
}

export function registerDelegatedWatch(
  items: Array<{ sku: string; quantity: number }>,
  conditions: IntentMandatePayload['conditions'],
  intentText: string
): DelegatedWatchJob {
  const intent = createIntentMandate('delegated', intentText, conditions);
  const id = `watch_${intent.id.slice(0, 8)}`;
  const job: DelegatedWatchJob = {
    id,
    intentMandate: intent,
    items,
    status: jobStatus(intent),
    createdAt: new Date().toISOString(),
    nextCheckAt: conditions.validFrom ?? new Date().toISOString(),
  };
  jobs.set(id, job);
  auditStore.logEvent('intent_created', { watchJobId: id, mode: 'delegated_watch' }, {
    mandateId: intent.id,
  });
  return job;
}

export async function executeWatchJob(jobId: string): Promise<BrokerResult> {
  const job = jobs.get(jobId);
  if (!job) return { success: false, errors: ['Watch job not found'] };
  if (job.status === 'executed') {
    return job.result ?? { success: true, errors: ['Already executed'] };
  }
  if (job.status === 'expired') {
    return { success: false, errors: ['Intent expired before execution'] };
  }

  const cartResult = await buildCart(job.intentMandate, job.items);
  if ('error' in cartResult) {
    job.status = 'blocked';
    job.result = { success: false, errors: [cartResult.error] };
    return job.result;
  }

  const skus = job.items.map((i) => i.sku);
  const status = jobStatus(
    job.intentMandate,
    cartResult.cartMandate.payload.totalCents,
    skus
  );
  job.status = status;

  if (status === 'waiting') {
    return { success: false, errors: ['Conditions not yet met (validFrom in future)'] };
  }
  if (status === 'blocked' || status === 'expired') {
    const check = validateIntentAgainstConditions(
      job.intentMandate,
      cartResult.cartMandate.payload.totalCents,
      skus
    );
    job.result = { success: false, errors: check.errors };
    return job.result;
  }

  const payment = createPaymentMandate(job.intentMandate, cartResult.cartMandate);
  const result = await submitPayment({
    intent: job.intentMandate,
    cart: cartResult.cartMandate,
    payment,
  });

  job.status = result.success ? 'executed' : 'blocked';
  job.executedAt = new Date().toISOString();
  job.result = result;
  return result;
}

export function listWatchJobs(): DelegatedWatchJob[] {
  return [...jobs.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getWatchJob(jobId: string): DelegatedWatchJob | undefined {
  return jobs.get(jobId);
}

/** Poll all waiting jobs; call from server interval or manual trigger */
export async function tickDelegatedMonitor(): Promise<DelegatedWatchJob[]> {
  const executed: DelegatedWatchJob[] = [];
  for (const job of jobs.values()) {
    if (job.status !== 'waiting' && job.status !== 'ready') continue;
    job.status = jobStatus(job.intentMandate);
    if (job.status === 'waiting') continue;
    if (job.status === 'expired') continue;
    await executeWatchJob(job.id);
    executed.push(job);
  }
  return executed;
}

let monitorInterval: ReturnType<typeof setInterval> | null = null;

export function startDelegatedMonitor(intervalMs = 5000): void {
  if (monitorInterval) return;
  monitorInterval = setInterval(() => {
    tickDelegatedMonitor().catch(console.error);
  }, intervalMs);
}

export function stopDelegatedMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
}
