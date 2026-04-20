"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";
import { useTranslation } from "@/components/LocaleProvider";
import { useAnalytics } from "@/hooks/useAnalytics";
import ConfirmDialog from "@/components/ConfirmDialog";
import type { ChatMessage, BomItem } from "@/types";

interface ChatContextBuildingInfo {
  address?: string;
  type?: string;
  year_built?: number;
  area_m2?: number;
  floors?: number;
  material?: string;
  heating?: string;
}

/** Check if two messages are from the same role and should be visually grouped */
function shouldGroup(current: ChatMessage, prev: ChatMessage | undefined): boolean {
  if (!prev) return false;
  return current.role === prev.role;
}

export default function ChatPanel({
  sceneJs,
  onApplyCode,
  bom,
  projectName,
  projectDescription,
  buildingInfo,
}: {
  sceneJs: string;
  onApplyCode: (code: string) => void;
  bom?: BomItem[];
  projectName?: string;
  projectDescription?: string;
  buildingInfo?: ChatContextBuildingInfo;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [skipConfirm, setSkipConfirm] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const usedSuggestionRef = useRef(false);
  const { toast } = useToast();
  const { t } = useTranslation();
  const { track } = useAnalytics();

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    if (messages.length > 0 && !expanded) {
      setExpanded(true);
    }
  }, [messages, expanded]);

  const autoResizeTextarea = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 96) + "px"; // ~4 lines max
  }, []);

  useEffect(() => {
    autoResizeTextarea();
  }, [input, autoResizeTextarea]);

  function handleApplyClick(code: string) {
    track("chat_code_applied", {} as Record<string, never>);
    if (skipConfirm) {
      onApplyCode(code);
      return;
    }
    setPendingCode(code);
  }

  function handleConfirmApply() {
    if (pendingCode) {
      onApplyCode(pendingCode);
      setPendingCode(null);
    }
  }

  async function send() {
    if (!input.trim() || loading) return;
    track("chat_message_sent", { suggestion_used: usedSuggestionRef.current });
    usedSuggestionRef.current = false;
    const userMsg: ChatMessage = { role: "user", content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setLoading(true);

    try {
      const bomSummary = bom?.map((item) => ({
        material: item.material_name || item.material_id,
        qty: item.quantity,
        unit: item.unit,
        total: item.total || (item.unit_price || 0) * item.quantity,
      }));
      const reply = await api.chat(newMessages, sceneJs, {
        bomSummary,
        buildingInfo,
        projectInfo: { name: projectName, description: projectDescription },
      });
      setMessages([...newMessages, reply]);
    } catch (err) {
      toast(err instanceof Error ? err.message : t('toast.aiError'), "error");
      setMessages([
        ...newMessages,
        { role: "assistant", content: t('editor.chatError') },
      ]);
    }
    setLoading(false);
  }

  function extractCode(content: string): string | null {
    const match = content.match(/```(?:javascript|js)?\n([\s\S]*?)```/);
    return match ? match[1].trim() : null;
  }

  /** Count scene.add calls in code to show preview hint */
  const countSceneObjects = useMemo(() => {
    return (code: string): number => {
      const matches = code.match(/scene\.add\(/g);
      return matches ? matches.length : 0;
    };
  }, []);

  return (
    <div className="chat-embedded">
      {/* Messages area - expands when there are messages */}
      {expanded && messages.length > 0 && (
        <div className="chat-messages-area">
          <button
            className="chat-collapse-btn"
            onClick={() => setExpanded(false)}
            title={t('editor.chatMinimize')}
            aria-label={t('editor.chatMinimize')}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <div className="chat-messages-scroll">
            {messages.map((msg, i) => {
              const code = msg.role === "assistant" ? extractCode(msg.content) : null;
              const textContent = msg.content
                .replace(/```(?:javascript|js)?\n[\s\S]*?```/g, "")
                .trim();
              const grouped = shouldGroup(msg, messages[i - 1]);

              return (
                <div
                  key={i}
                  className={`chat-msg ${msg.role === "user" ? "chat-msg-user" : "chat-msg-ai"}${grouped ? " chat-msg-grouped" : ""}`}
                >
                  {msg.role === "assistant" && !grouped && (
                    <div className={`chat-msg-avatar${loading && i === messages.length - 1 ? " chat-avatar-active" : ""}`}>
                      {/* Nordic-inspired geometric house icon */}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                      </svg>
                    </div>
                  )}
                  {msg.role === "assistant" && grouped && (
                    <div className="chat-msg-avatar-spacer" />
                  )}
                  <div className="chat-msg-content">
                    {textContent && <span>{textContent}</span>}
                    {code && (
                      <div className="chat-apply-bar">
                        <button
                          className="chat-apply-btn"
                          onClick={() => handleApplyClick(code)}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          {t('editor.applyToScene')}
                        </button>
                        <span className="chat-apply-hint">
                          {countSceneObjects(code)} {countSceneObjects(code) === 1 ? t('editor.objectSingular') : t('editor.objectPlural')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {loading && (
              <div className="chat-msg chat-msg-ai">
                <div className="chat-msg-avatar chat-avatar-active">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                </div>
                <div className="chat-msg-content">
                  <div className="chat-shimmer-bar" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Collapsed indicator when there are messages but panel is collapsed */}
      {!expanded && messages.length > 0 && (
        <button
          className="chat-expand-btn"
          onClick={() => setExpanded(true)}
          aria-label={t('editor.chatExpand')}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15" />
          </svg>
          <span>{messages.length} {messages.length === 1 ? t('editor.message') || "message" : t('editor.messages') || "messages"}</span>
        </button>
      )}

      {/* Suggestion chips when empty */}
      {messages.length === 0 && !loading && (
        <div style={{
          display: "flex",
          gap: 6,
          padding: "0 0 6px 0",
          flexWrap: "wrap",
        }}>
          {[
            t('editor.suggestionRoof') || "Add a pitched roof",
            t('editor.suggestionWindow') || "Add a window",
            t('editor.suggestionGarage') || "Attach a garage",
          ].map((suggestion) => (
            <button
              key={suggestion}
              className="chat-suggestion-chip"
              onClick={() => {
                setInput(suggestion);
                usedSuggestionRef.current = true;
                inputRef.current?.focus();
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Input bar - always visible */}
      <div className={`chat-input-bar${inputFocused ? " chat-input-bar-focused" : ""}`}>
        <svg className="chat-input-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        <textarea
          ref={inputRef}
          className="chat-input"
          value={input}
          rows={1}
          onChange={(e) => {
            setInput(e.target.value);
            autoResizeTextarea();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          placeholder={messages.length === 0 ? t('editor.describeChange') : t('editor.continueConversation')}
          disabled={loading}
          aria-label={t('editor.chatInputLabel')}
        />
        <button
          className="chat-send-btn"
          onClick={send}
          disabled={loading || !input.trim()}
          data-ready={!!input.trim()}
          aria-label={t('editor.chatSendLabel')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>

      <ConfirmDialog
        open={pendingCode !== null}
        title={t('editor.confirmApplyTitle') || "Apply AI-generated code?"}
        message={
          (t('editor.confirmApplyMessage') ||
            "This will replace your current scene script with the AI-generated code.") +
          "\n\n" +
          (t('editor.confirmApplyUndo') || "You can undo with") +
          ` ${navigator.platform?.includes("Mac") ? "Cmd" : "Ctrl"}+Z`
        }
        confirmText={t('editor.applyToScene') || "Apply to scene"}
        cancelText={t('editor.cancel') || "Cancel"}
        onConfirm={handleConfirmApply}
        onCancel={() => setPendingCode(null)}
      />
      {pendingCode !== null && (
        <div className="chat-skip-confirm">
          <input
            type="checkbox"
            id="skip-confirm"
            checked={skipConfirm}
            onChange={(e) => setSkipConfirm(e.target.checked)}
            style={{ accentColor: "var(--accent)" }}
          />
          <label htmlFor="skip-confirm" style={{ cursor: "pointer" }}>
            {t('editor.dontAskAgain') || "Don't ask again this session"}
          </label>
        </div>
      )}
    </div>
  );
}
