import { useEffect, useMemo, useRef, useState } from "react";
import { chatWithAssistant } from "../../api/assistant.api";
import type { ChatAssistantMessage, ChatAssistantRecommendation } from "../../types/assistant";
import AssistantLottieMascot from "./AssistantLottieMascot";
import AssistantRecommendationCards from "./AssistantRecommendationCards";
import styles from "../../style/chat-assistant-widget.module.css";

export type ChatAssistantWidgetProps = {
  activityTemplateId?: string | null;
  sessionId?: string | null;
  activityTitle?: string;
  difficulty?: string | null;
  tags?: string[] | null;
  price?: number | null;
  weatherSummary?: string | null;
  location?: string | null;
  selectedSessionLabel?: string | null;
  availabilityLabel?: string | null;
  mode?: "activity" | "general";
};

type LocalMessage = ChatAssistantMessage & {
  id: string;
  fallback?: boolean;
  recommendations?: ChatAssistantRecommendation[];
  createdAt?: number;
};

type StoredAssistantState = {
  updatedAt: number;
  messages: LocalMessage[];
};

const ACTIVITY_SUGGESTIONS = ["Pack list", "Beginner?", "Rain forecast?", "Easier options", "Getting there"];
const GENERAL_SUGGESTIONS = ["Find activity", "Day trip pack", "Easy options", "How booking works"];

const PROMPT_BY_LABEL: Record<string, string> = {
  "Pack list": "What should I bring for this activity?",
  "Beginner?": "Is this beginner friendly?",
  "Rain forecast?": "How should I prepare for the weather?",
  "Easier options": "Recommend something easier than this.",
  "Getting there": "What should I know before getting there?",
  "Find activity": "Help me find an activity.",
  "Day trip pack": "What should I pack for a day trip?",
  "Easy options": "Recommend something easy.",
  "How booking works": "How does booking work?",
};

const STORAGE_KEY = "untamed.activityAssistant.history";
const HISTORY_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_STORED_MESSAGES = 30;

function buildId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function greeting(mode: "activity" | "general"): LocalMessage {
  return {
    id: "assistant-greeting",
    role: "assistant",
    createdAt: Date.now(),
    content:
      mode === "general"
        ? "Hi, I'm Trail Guide. I can help you find activities, plan gear, or explain how Untamed works."
        : "Hi, I'm Trail Guide. Ask me about this activity, gear, safety, weather prep, or easier alternatives.",
  };
}

function loadStoredMessages(mode: "activity" | "general") {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [greeting(mode)];
    const parsed = JSON.parse(raw) as StoredAssistantState;
    if (!parsed?.updatedAt || Date.now() - parsed.updatedAt > HISTORY_TTL_MS) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return [greeting(mode)];
    }
    const messages = Array.isArray(parsed.messages) ? parsed.messages : [];
    return messages.length ? messages.slice(-MAX_STORED_MESSAGES) : [greeting(mode)];
  } catch {
    return [greeting(mode)];
  }
}

function saveStoredMessages(messages: LocalMessage[]) {
  try {
    const payload: StoredAssistantState = {
      updatedAt: Date.now(),
      messages: messages.slice(-MAX_STORED_MESSAGES),
    };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Chat persistence is optional.
  }
}

export default function ChatAssistantWidget({
  activityTemplateId,
  sessionId,
  activityTitle,
  difficulty,
  tags,
  price,
  weatherSummary,
  location,
  selectedSessionLabel,
  availabilityLabel,
  mode,
}: ChatAssistantWidgetProps) {
  const resolvedMode: "activity" | "general" = mode ?? (activityTemplateId ? "activity" : "general");
  const [open, setOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(true);
  const [messages, setMessages] = useState<LocalMessage[]>(() => loadStoredMessages(resolvedMode));
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState(resolvedMode === "activity" ? ACTIVITY_SUGGESTIONS : GENERAL_SUGGESTIONS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pageContext = useMemo(() => {
    const parts = [
      resolvedMode === "general" ? "Current page: Untamed home and activity discovery." : null,
      activityTitle ? `Current activity page: ${activityTitle}` : null,
      difficulty ? `Difficulty: ${difficulty}` : null,
      tags?.length ? `Tags: ${tags.slice(0, 8).join(", ")}` : null,
      typeof price === "number" && Number.isFinite(price) ? `Price: ${price} TND` : null,
      location ? `Displayed location: ${location}` : null,
      selectedSessionLabel ? `Selected session: ${selectedSessionLabel}` : null,
      availabilityLabel ? `Selected session availability: ${availabilityLabel}` : null,
      resolvedMode === "activity" ? `Displayed weather summary for selected session: ${weatherSummary || "forecast unavailable"}` : null,
    ].filter(Boolean);
    return parts.join("\n");
  }, [activityTitle, availabilityLabel, difficulty, location, price, resolvedMode, selectedSessionLabel, tags, weatherSummary]);

  const canSend = input.trim().length > 0 && input.trim().length <= 1200 && !loading;
  const contextTitle = resolvedMode === "activity" && activityTitle ? activityTitle : "Untamed general assistant";
  const weatherBadge = resolvedMode === "activity" ? summarizeWeatherBadge(weatherSummary) : null;

  useEffect(() => {
    saveStoredMessages(messages);
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  function openWidget() {
    setOpen(true);
    setHasUnread(false);
  }

  function clearChat() {
    window.sessionStorage.removeItem(STORAGE_KEY);
    setMessages([greeting(resolvedMode)]);
    setSuggestions(resolvedMode === "activity" ? ACTIVITY_SUGGESTIONS : GENERAL_SUGGESTIONS);
    setError(null);
  }

  async function sendMessage(raw: string) {
    const text = raw.trim();
    if (!text || loading) return;

    if (text.length > 1200) {
      setError("Please keep your question under 1200 characters.");
      return;
    }

    const userMessage: LocalMessage = {
      id: buildId(),
      role: "user",
      content: text,
      createdAt: Date.now(),
    };

    const previousMessages = messages;
    setMessages([...previousMessages, userMessage]);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const history = previousMessages
        .filter((message) => message.id !== "assistant-greeting")
        .slice(-8)
        .map(({ role, content }) => ({ role, content }));

      const response = await chatWithAssistant({
        message: text,
        activityTemplateId,
        sessionId,
        pageContext: pageContext || undefined,
        history,
      });

      const assistantMessage: LocalMessage = {
        id: buildId(),
        role: "assistant",
        content: response.answer,
        fallback: response.fallback,
        recommendations: response.recommendations ?? [],
        createdAt: Date.now(),
      };
      setMessages((current) => [...current, assistantMessage]);
      setSuggestions(response.suggestedQuestions?.length ? response.suggestedQuestions : resolvedMode === "activity" ? ACTIVITY_SUGGESTIONS : GENERAL_SUGGESTIONS);
      if (!open) setHasUnread(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Assistant failed to answer.";
      setError(message);
      setMessages((current) => [
        ...current,
        {
          id: buildId(),
          role: "assistant",
          content: "I could not reach Trail Guide right now. Please check activity details, weather, meeting point, and safety notes before going.",
          fallback: true,
          createdAt: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  function handleSuggestionClick(question: string) {
    openWidget();
    void sendMessage(PROMPT_BY_LABEL[question] ?? question);
  }

  return (
    <div className={`${styles.widgetShell} ${open ? styles.widgetShellOpen : ""}`}>
      {open && (
        <section className={styles.panel} aria-label="Untamed Trail Guide assistant">
          <header className={styles.header}>
            <div className={styles.headerIdentity}>
              <AssistantLottieMascot size={46} active={open} className={styles.headerMascot} />
              <div>
                <span className={styles.eyebrow}>Untamed AI</span>
                <h2>Trail Guide</h2>
                <p>Online - Outdoor assistant</p>
              </div>
            </div>
            <div className={styles.headerActions}>
              <button type="button" className={styles.iconButton} onClick={clearChat} aria-label="Clear Trail Guide chat">
                Clear
              </button>
              <button type="button" className={styles.closeButton} onClick={() => setOpen(false)} aria-label="Close Trail Guide assistant">
                x
              </button>
            </div>
          </header>

          <div className={styles.messages} aria-live="polite">
            <div className={styles.contextBadge}>
              <span className={styles.contextIcon} aria-hidden="true">{resolvedMode === "activity" ? "A" : "U"}</span>
              <span className={styles.contextTitle}>{contextTitle}</span>
              {weatherBadge && <span className={styles.weatherBadge}>{weatherBadge}</span>}
            </div>

            {messages.map((message) => (
              <div key={message.id} className={`${styles.messageRow} ${message.role === "user" ? styles.messageUser : styles.messageAssistant}`}>
                <div className={styles.messageBubble}>
                  <p>{renderMessageContent(message)}</p>
                  {message.fallback && <span className={styles.fallbackBadge}>Fallback</span>}
                  {message.createdAt && <span className={styles.messageTime}>{formatMessageTime(message.createdAt)}</span>}
                  {message.role === "assistant" && (
                    <AssistantRecommendationCards recommendations={message.recommendations} onNavigate={() => setOpen(true)} />
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className={`${styles.messageRow} ${styles.messageAssistant}`}>
                <div className={styles.messageBubble}>
                  <span className={styles.typingDots} aria-label="Trail Guide is typing">
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className={styles.suggestions}>
            {suggestions.slice(0, 5).map((question) => (
              <button key={question} type="button" onClick={() => handleSuggestionClick(question)} disabled={loading}>
                {shortChipLabel(question)}
              </button>
            ))}
          </div>

          {error && <div className={styles.errorText}>{error}</div>}

          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              if (canSend) void sendMessage(input);
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              maxLength={1200}
              placeholder={resolvedMode === "activity" ? "Ask about this activity..." : "Ask Trail Guide..."}
              aria-label="Ask Trail Guide"
              disabled={loading}
            />
            <button type="submit" disabled={!canSend} aria-label="Send message">
              <span aria-hidden="true">{loading ? "..." : ">"}</span>
            </button>
          </form>
          <div className={styles.poweredBy}>Powered by Untamed AI - context-aware</div>
        </section>
      )}

      <button
        type="button"
        className={styles.launchButton}
        onClick={() => (open ? setOpen(false) : openWidget())}
        aria-expanded={open}
        aria-label={open ? "Hide Untamed AI assistant" : "Open Untamed AI assistant"}
      >
        <AssistantLottieMascot size={108} active={!open} className={styles.fabMascot} />
        {hasUnread && !open && <span className={styles.notifyDot} aria-hidden="true" />}
        <span className={styles.launchLabel}>Trail Guide</span>
      </button>
    </div>
  );
}

function formatMessageTime(value: number) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function summarizeWeatherBadge(weatherSummary?: string | null) {
  if (!weatherSummary) return null;
  const range = weatherSummary.match(/(-?\d+)-(-?\d+) C/);
  if (range) return `${range[1]}-${range[2]} C`;
  if (weatherSummary.toLowerCase().includes("unavailable")) return "Forecast unavailable";
  if (weatherSummary.toLowerCase().includes("loading")) return "Weather loading";
  return null;
}

function renderMessageContent(message: LocalMessage) {
  const hasRecommendations = message.role === "assistant" && (message.recommendations?.length ?? 0) > 0;
  if (!hasRecommendations) return message.content;

  const normalized = message.content.toLowerCase();
  const likelyRawList = /\n?\s*\d+\.\s+\*?\*?[a-z0-9]/i.test(message.content) || normalized.includes("**");
  if (likelyRawList || message.content.length > 140) {
    return "Here are real options from Untamed:";
  }
  return message.content.trim() || "Here are real options from Untamed:";
}

function shortChipLabel(question: string) {
  if (question.includes("bring") || question.includes("pack")) return "Pack list";
  if (question.includes("beginner") || question.includes("easier")) return "Beginner?";
  if (question.includes("weather") || question.includes("Rain")) return "Rain forecast?";
  if (question.includes("Compare")) return "Compare";
  if (question.includes("booking")) return "Booking";
  if (question.length > 18) return `${question.slice(0, 17)}...`;
  return question;
}
