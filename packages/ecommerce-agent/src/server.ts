import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  AGENT_CARD_PATH,
  type AgentCard,
  type Message,
} from '@a2a-js/sdk';
import {
  AgentExecutor,
  DefaultRequestHandler,
  InMemoryTaskStore,
  type ExecutionEventBus,
  type RequestContext,
} from '@a2a-js/sdk/server';
import {
  agentCardHandler,
  jsonRpcHandler,
  restHandler,
  UserBuilder,
} from '@a2a-js/sdk/server/express';
import {
  computeTax,
  createMandate,
  getProduct,
  searchProducts,
  type CartLineItem,
  type CartMandatePayload,
  type IntentMandate,
} from '@pixelium/shared';

const PORT = Number(process.env.ECOMMERCE_PORT ?? 4001);
const BASE_URL = process.env.ECOMMERCE_URL ?? `http://localhost:${PORT}`;

const agentCard: AgentCard = {
  name: 'Pixelium E-Commerce Agent',
  description: 'Catalog search, cart building, and merchant-signed cart mandates.',
  protocolVersion: '0.3.0',
  version: '0.1.0',
  url: `${BASE_URL}/a2a/jsonrpc`,
  skills: [
    {
      id: 'search_catalog',
      name: 'Search Catalog',
      description: 'Search the mock product catalog by keyword',
      tags: ['catalog', 'search'],
    },
    {
      id: 'build_cart',
      name: 'Build Cart',
      description: 'Create a cart from SKUs and produce a merchant-signed Cart Mandate',
      tags: ['cart', 'checkout'],
    },
  ],
  capabilities: { pushNotifications: false },
  defaultInputModes: ['text'],
  defaultOutputModes: ['text'],
  additionalInterfaces: [
    { url: `${BASE_URL}/a2a/jsonrpc`, transport: 'JSONRPC' },
    { url: `${BASE_URL}/a2a/rest`, transport: 'HTTP+JSON' },
  ],
};

interface BuildCartRequest {
  action: 'build_cart';
  intentMandate: IntentMandate;
  items: Array<{ sku: string; quantity: number }>;
}

interface SearchRequest {
  action: 'search';
  query: string;
}

type AgentRequest = BuildCartRequest | SearchRequest;

function parseRequest(text: string): AgentRequest | null {
  try {
    return JSON.parse(text) as AgentRequest;
  } catch {
    if (text.startsWith('search:')) {
      return { action: 'search', query: text.slice('search:'.length).trim() };
    }
    return null;
  }
}

class EcommerceExecutor implements AgentExecutor {
  async execute(
    requestContext: RequestContext,
    eventBus: ExecutionEventBus
  ): Promise<void> {
    const inputText =
      requestContext.userMessage.parts.find((p) => p.kind === 'text')?.text ?? '';
    const req = parseRequest(inputText);

    let responseText: string;

    if (!req) {
      responseText = JSON.stringify({
        error: 'Send JSON: { action: "search", query: "..." } or { action: "build_cart", intentMandate, items }',
      });
    } else if (req.action === 'search') {
      const products = searchProducts(req.query);
      responseText = JSON.stringify({ products });
    } else {
      responseText = JSON.stringify(this.buildCart(req));
    }

    const responseMessage: Message = {
      kind: 'message',
      messageId: uuidv4(),
      role: 'agent',
      parts: [{ kind: 'text', text: responseText }],
      contextId: requestContext.contextId,
    };

    eventBus.publish(responseMessage);
    eventBus.finished();
  }

  private buildCart(req: BuildCartRequest) {
    const lineItems: CartLineItem[] = [];
    let subtotalCents = 0;

    for (const { sku, quantity } of req.items) {
      const product = getProduct(sku);
      if (!product) {
        return { error: `Unknown SKU: ${sku}` };
      }
      if (product.inStock < quantity) {
        return { error: `Insufficient stock for ${sku}` };
      }
      lineItems.push({
        sku,
        name: product.name,
        quantity,
        unitPriceCents: product.priceCents,
      });
      subtotalCents += product.priceCents * quantity;
    }

    const taxCents = computeTax(subtotalCents);
    const totalCents = subtotalCents + taxCents;
    const cartId = uuidv4();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const payload: CartMandatePayload = {
      cartId,
      merchantId: 'pixelium-merchant',
      merchantName: 'Pixelium Store',
      items: lineItems,
      subtotalCents,
      taxCents,
      totalCents,
      currency: 'USD',
      intentMandateId: req.intentMandate.id,
    };

    const cartMandate = createMandate(
      'cart',
      'merchant',
      payload,
      expiresAt,
      req.intentMandate.id
    );

    return { cartMandate, subtotalCents, taxCents, totalCents };
  }

  cancelTask = async (): Promise<void> => {};
}

const requestHandler = new DefaultRequestHandler(
  agentCard,
  new InMemoryTaskStore(),
  new EcommerceExecutor()
);

const app = express();
app.use(express.json());
app.use(`/${AGENT_CARD_PATH}`, agentCardHandler({ agentCardProvider: requestHandler }));
app.use('/a2a/jsonrpc', jsonRpcHandler({ requestHandler, userBuilder: UserBuilder.noAuthentication }));
app.use('/a2a/rest', restHandler({ requestHandler, userBuilder: UserBuilder.noAuthentication }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', agent: agentCard.name });
});

app.listen(PORT, () => {
  console.log(`🛒 E-Commerce Agent on ${BASE_URL}`);
  console.log(`   Agent Card: ${BASE_URL}/${AGENT_CARD_PATH}`);
});
