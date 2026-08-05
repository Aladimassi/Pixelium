import './load-env.js';
import { parseShoppingIntent, isGroqConfigured } from './groq-intent.js';
import { runDelegatedPurchase, runRealtimePurchase } from './broker.js';

async function main() {
  const message =
    process.argv.slice(2).join(' ') ||
    'Buy me the red high-top sneakers, budget under $200';

  console.log('\n=== Groq AI Purchase Demo ===\n');
  console.log(`Message: "${message}"`);
  console.log(`Groq configured: ${isGroqConfigured()}\n`);

  const parsed = await parseShoppingIntent(message);
  console.log('Parsed intent:', JSON.stringify(parsed, null, 2));

  const items = [{ sku: parsed.sku, quantity: parsed.quantity }];
  const validUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const result =
    parsed.flowMode === 'delegated'
      ? await runDelegatedPurchase(items, {
          maxPriceCents: parsed.maxPriceCents,
          allowedSkus: [parsed.sku],
          validUntil,
        }, parsed.naturalLanguageIntent)
      : await runRealtimePurchase(items, parsed.maxPriceCents, parsed.naturalLanguageIntent);

  if (result.success) {
    console.log('\n✅ AI purchase successful');
    console.log(`   Transaction: ${result.payment?.transactionId}`);
    console.log(`   Amount: $${((result.payment?.amountCents ?? 0) / 100).toFixed(2)}`);
  } else {
    console.log('\n❌ Purchase blocked');
    console.log('   Errors:', result.errors?.join('; '));
  }
}

main().catch(console.error);
