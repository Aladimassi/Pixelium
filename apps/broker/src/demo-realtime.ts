/**
 * Demo: Human-present (real-time) purchase flow
 * User approves intent → cart → payment in sequence
 */
import { runRealtimePurchase } from './broker.js';

async function main() {
  console.log('\n=== Real-Time Purchase Demo ===\n');

  const result = await runRealtimePurchase(
    [{ sku: 'SHOE-RED-HIGH', quantity: 1 }],
    20000,
    'Buy me the classic red high-top sneakers'
  );

  if (result.success) {
    console.log('✅ Purchase successful');
    console.log(`   Transaction: ${result.payment?.transactionId}`);
    console.log(`   Amount: $${((result.payment?.amountCents ?? 0) / 100).toFixed(2)}`);
  } else {
    console.log('❌ Purchase blocked');
    console.log('   Errors:', result.errors?.join('; '));
  }
}

main().catch(console.error);
