import { useState } from "react";
import type { MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import * as ChatApi from "../api/chat.api";

type OpenSessionChatButtonProps = {
  sessionId?: string | null;
  className?: string;
  label?: string;
  disabled?: boolean;
  onError?: (message: string) => void;
  onClickCapture?: (event: MouseEvent<HTMLButtonElement>) => void;
};

function friendlyChatError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (/HTTP 403/i.test(message)) return "Chat is available after booking is confirmed.";
  if (/HTTP 404/i.test(message)) return "Session chat was not found.";
  return message || "Could not open session chat.";
}

export function OpenSessionChatButton({
  sessionId,
  className,
  label = "Open chat",
  disabled = false,
  onError,
  onClickCapture,
}: OpenSessionChatButtonProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleOpen = async (event: MouseEvent<HTMLButtonElement>) => {
    onClickCapture?.(event);
    if (event.defaultPrevented) return;

    if (!sessionId || loading || disabled) return;

    setLoading(true);
    setLocalError(null);
    try {
      const room = await ChatApi.getSessionChatRoom(sessionId);
      navigate(`/chat/rooms/${room.id}`);
    } catch (error) {
      const message = friendlyChatError(error);
      if (onError) {
        onError(message);
      } else {
        setLocalError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!sessionId) return null;

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={handleOpen}
        disabled={disabled || loading}
        aria-busy={loading}
      >
        {loading ? "Opening..." : label}
      </button>
      {localError && (
        <span role="status" style={{ color: "#7b3a30", fontSize: 12 }}>
          {localError}
        </span>
      )}
    </>
  );
}
