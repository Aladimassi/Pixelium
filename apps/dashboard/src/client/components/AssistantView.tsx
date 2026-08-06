import { useEffect, useRef } from 'react';
import { useVoiceInput } from '../hooks/useSpeechRecognition';
import { formatPrice, handleProductImageError, productImageUrl } from '../lib/cart';
import { formatCategoryLabel } from '../lib/product-meta';
import type { AiChatTurn } from './ShopView';

const STARTER_PROMPTS = [
  'Recommend running shoes for winter',
  'What headphones do you have under $200?',
  'I need a gift for someone who loves coffee',
];

interface AssistantViewProps {
  groqOn?: boolean;
  groqBadge: React.ReactNode;
  voiceLabel?: string;
  brokerUrl: string;
  aiMessage: string;
  aiChatHistory: AiChatTurn[];
  aiBusy?: boolean;
  onAddToCart: (sku: string) => void;
  onAiMessageChange: (msg: string) => void;
  onAiChatSend: (message?: string) => void;
  onClearAiChat: () => void;
}

export function AssistantView({
  groqOn,
  groqBadge,
  voiceLabel = 'Voice input',
  brokerUrl,
  aiMessage,
  aiChatHistory,
  aiBusy = false,
  onAddToCart,
  onAiMessageChange,
  onAiChatSend,
  onClearAiChat,
}: AssistantViewProps) {
  const voice = useVoiceInput({
    brokerUrl,
    value: aiMessage,
    onChange: onAiMessageChange,
  });

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [aiChatHistory.length, aiBusy]);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onAiChatSend();
    }
  };

  return (
    <div id="assistant-view" className="page-view">
      <section className="ai-assistant container ai-assistant--page" aria-label="AI shopping assistant">
        <div className="ai-assistant__card ai-assistant__card--page">
          <div className="ai-assistant__head">
            <div>
              <p className="section-header__eyebrow">Shopping assistant</p>
              <h1 className="ai-assistant__title">Chat with your shopping assistant</h1>
              <p className="hint">
                Ask for recommendations, compare products, or say &quot;buy headphones&quot; — checkout
                opens only after you approve payment. Save your address in Profile → Delivery for faster buys.
              </p>
            </div>
            <div className="ai-assistant__head-actions">
              {aiChatHistory.length > 0 ? (
                <button type="button" className="btn-ghost btn-sm" onClick={onClearAiChat} disabled={aiBusy}>
                  Clear chat
                </button>
              ) : null}
              <span id="groq-badge" className={`badge${groqOn ? ' groq-on' : ' groq-off'}`}>
                <span className="live-dot" aria-hidden="true" />
                {groqBadge}
              </span>
            </div>
          </div>

          {!groqOn ? (
            <p className="ai-status-banner" role="status">
              AI is in keyword mode — set <code>GROQ_API_KEY</code> on the server for full conversational shopping.
            </p>
          ) : (
            <p className="ai-status-banner ai-status-banner--on" role="status">
              Assistant is online and ready to help you shop.
            </p>
          )}

          <div className="ai-chat ai-chat--page" aria-label="Conversation" role="log">
            {aiChatHistory.length === 0 ? (
              <div className="ai-chat__welcome">
                <p className="ai-chat__welcome-title">How can I help you shop today?</p>
                <p className="hint">Try one of these, or type your own question below.</p>
                <div className="ai-chat__starters">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="btn-secondary btn-sm ai-starter-btn"
                      disabled={aiBusy}
                      onClick={() => onAiChatSend(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              aiChatHistory.map((turn, i) => (
                <div key={`${turn.role}-${i}`} className={`ai-chat__turn ai-chat__turn--${turn.role}`}>
                  <div className="ai-chat__bubble">
                    <p className="ai-chat__text">{turn.content}</p>
                    {turn.picks && turn.picks.length > 0 ? (
                      <ul className="ai-result__list ai-chat__picks">
                        {turn.picks.map((p) => (
                          <li key={p.sku} className="ai-result__item">
                            <img
                              className="ai-result__thumb"
                              src={productImageUrl(p)}
                              alt=""
                              loading="lazy"
                              data-sku={p.sku}
                              onError={handleProductImageError}
                            />
                            <div>
                              <strong>{p.name}</strong>
                              <span>
                                {formatPrice(p.priceCents)} · {formatCategoryLabel(p.category)}
                              </span>
                              <p className="hint">{p.reason}</p>
                              <button
                                type="button"
                                className="btn-ghost btn-sm ai-add"
                                onClick={() => onAddToCart(p.sku)}
                              >
                                Add to cart
                              </button>
                              <button
                                type="button"
                                className="btn-primary btn-sm ai-add"
                                disabled={aiBusy}
                                onClick={() => onAiChatSend(`Buy ${p.name}`)}
                              >
                                Buy now
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
              ))
            )}
            {aiBusy ? (
              <div className="ai-chat__turn ai-chat__turn--assistant">
                <div className="ai-chat__bubble ai-chat__bubble--typing">
                  <span className="ai-chat__typing-dot" aria-hidden="true" />
                  <span className="ai-chat__typing-dot" aria-hidden="true" />
                  <span className="ai-chat__typing-dot" aria-hidden="true" />
                  <span className="sr-only">Assistant is thinking…</span>
                </div>
              </div>
            ) : null}
            <div ref={chatEndRef} />
          </div>

          <label htmlFor="ai-message" className="sr-only">
            Message the shopping assistant
          </label>
          <div className="ai-assistant__input-row">
            <input
              type="text"
              id="ai-message"
              className="ai-assistant__input"
              placeholder='Ask anything — e.g. "Recommend running shoes"'
              value={aiMessage}
              onChange={(e) => onAiMessageChange(e.target.value)}
              onKeyDown={handleInputKeyDown}
              disabled={aiBusy}
              autoFocus
            />
            <button
              type="button"
              id="btn-ai-send"
              className="btn-primary ai-send-btn"
              onClick={() => onAiChatSend()}
              disabled={aiBusy || !aiMessage.trim()}
            >
              {aiBusy ? '…' : 'Send'}
            </button>
            <button
              type="button"
              id="btn-ai-voice"
              className={`ai-voice-btn${voice.listening ? ' ai-voice-btn--active' : ''}`}
              onClick={voice.toggleListening}
              disabled={!voice.supported || voice.processing}
              aria-pressed={voice.listening}
              aria-label={voice.listening ? 'Stop recording' : 'Record voice input'}
            >
              <span className="ai-voice-btn__icon" aria-hidden="true">
                {voice.processing ? '…' : voice.listening ? '◼' : '🎤'}
              </span>
            </button>
          </div>
          {voice.processing ? (
            <p className="ai-voice-status" aria-live="polite">
              <span className="ai-voice-status__dot" aria-hidden="true" />
              Transcribing with {voiceLabel}…
            </p>
          ) : voice.listening ? (
            <p className="ai-voice-status" aria-live="polite">
              <span className="ai-voice-status__dot" aria-hidden="true" />
              Recording… tap again when done
            </p>
          ) : !voice.supported ? (
            <p className="hint ai-voice-hint" role="status">
              Voice input needs HTTPS and a microphone — type your message above instead.
            </p>
          ) : null}
          {voice.error ? (
            <p className="form-error ai-voice-error" role="alert">
              {voice.error}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
