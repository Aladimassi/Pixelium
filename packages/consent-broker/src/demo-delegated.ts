/**
 * Demo: Human-not-present (delegated) purchase flow
 * Pre-signed intent with price ceiling and SKU constraint
 */
import { runDelegatedPurchase } from './broker.js';

async function main() {
  console.log('\n=== Delegated Purchase Demo ===\n');

  const validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const result = await runDelegatedPurchase(
    [{ sku: 'PHONE-17-PRO', quantity: 1 }],
    {
      maxPriceCents: 190000,
      allowedSkus: ['PHONE-17-PRO'],
      validUntil,
      validFrom: new Date().toISOString(),
    },
    'Buy PixelPhone 17 Pro when price is under $1800 — I am not available to approve manually'
  );

  if (result.success) {
    console.log('✅ Delegated purchase executed');
    console.log(`   Transaction: ${result.payment?.transactionId}`);
    console.log(`   Amount: $${((result.payment?.amountCents ?? 0) / 100).toFixed(2)}`);
  } else {
    console.log('❌ Delegated purchase blocked');
    console.log('   Errors:', result.errors?.join('; '));
  }
}

main().catch(console.error);
