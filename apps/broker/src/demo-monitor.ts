/**
 * Demo: register a delegated watch with validFrom in the past → executes immediately on tick
 */
import { registerDelegatedWatch, executeWatchJob } from './delegated-monitor.js';

async function main() {
  console.log('\n=== Delegated Monitor Demo ===\n');

  const validUntil = new Date(Date.now() + 7 * 86400000).toISOString();
  const job = registerDelegatedWatch(
    [{ sku: 'BOOK-AI-AGENTS', quantity: 1 }],
    {
      maxPriceCents: 10000,
      allowedSkus: ['BOOK-AI-AGENTS'],
      validUntil,
      validFrom: new Date(Date.now() - 1000).toISOString(),
    },
    'Auto-buy agentic systems book when I am away'
  );

  console.log(`Registered watch job: ${job.id} (status: ${job.status})`);

  const result = await executeWatchJob(job.id);
  if (result.success) {
    console.log('✅ Monitor executed purchase');
    console.log(`   Transaction: ${result.payment?.transactionId}`);
    console.log(`   Amount: $${((result.payment?.amountCents ?? 0) / 100).toFixed(2)}`);
  } else {
    console.log('❌ Monitor blocked purchase');
    console.log('   Errors:', result.errors?.join('; '));
  }
}

main().catch(console.error);
