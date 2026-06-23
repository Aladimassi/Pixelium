import express from 'express';
import { randomUUID } from 'node:crypto';
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
import type { MandateChain, PaymentResult } from '@pixelium/shared';

const PORT = Number(process.env.PAYMENT_PORT ?? 4002);
const BASE_URL = process.env.PAYMENT_URL ?? `http://localhost:${PORT}`;

const processedPayments = new Set<string>();

const agentCard: AgentCard = {
  name: 'Pixelium Payment Agent',
  description: 'Mock payment processor — accepts payment tasks with a valid mandate chain.',
  protocolVersion: '0.3.0',
  version: '0.1.0',
  url: `${BASE_URL}/a2a/jsonrpc`,
  skills: [
    {
      id: 'process_payment',
      name: 'Process Payment',
      description: 'Charge a mock card when a complete signed mandate chain is provided',
      tags: ['payment', 'checkout'],
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

interface ProcessPaymentRequest {
  action: 'process_payment';
  mandateChain: MandateChain;
}

class PaymentExecutor implements AgentExecutor {
  async execute(
    requestContext: RequestContext,
    eventBus: ExecutionEventBus
  ): Promise<void> {
    const inputText =
      requestContext.userMessage.parts.find((p) => p.kind === 'text')?.text ?? '';

    let responseText: string;

    try {
      const req = JSON.parse(inputText) as ProcessPaymentRequest;
      if (req.action !== 'process_payment') {
        responseText = JSON.stringify({ error: 'Expected action: process_payment' });
      } else {
        responseText = JSON.stringify(this.processPayment(req.mandateChain));
      }
    } catch {
      responseText = JSON.stringify({
        error: 'Send JSON: { action: "process_payment", mandateChain: {...} }',
      });
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

  private processPayment(chain: MandateChain): PaymentResult {
    const paymentId = chain.payment.payload.paymentId;

    if (processedPayments.has(paymentId)) {
      return {
        success: false,
        transactionId: '',
        amountCents: chain.payment.payload.amountCents,
        timestamp: new Date().toISOString(),
        message: 'Payment already processed (replay rejected)',
      };
    }

    processedPayments.add(paymentId);

    return {
      success: true,
      transactionId: `txn_${randomUUID().slice(0, 8)}`,
      amountCents: chain.payment.payload.amountCents,
      timestamp: new Date().toISOString(),
      message: `Mock charge of $${(chain.payment.payload.amountCents / 100).toFixed(2)} approved`,
    };
  }

  cancelTask = async (): Promise<void> => {};
}

const requestHandler = new DefaultRequestHandler(
  agentCard,
  new InMemoryTaskStore(),
  new PaymentExecutor()
);

const app = express();
app.use(express.json());
app.use(`/${AGENT_CARD_PATH}`, agentCardHandler({ agentCardProvider: requestHandler }));
app.use('/a2a/jsonrpc', jsonRpcHandler({ requestHandler, userBuilder: UserBuilder.noAuthentication }));
app.use('/a2a/rest', restHandler({ requestHandler, userBuilder: UserBuilder.noAuthentication }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', agent: agentCard.name, processedCount: processedPayments.size });
});

app.listen(PORT, () => {
  console.log(`💳 Payment Agent on ${BASE_URL}`);
});
