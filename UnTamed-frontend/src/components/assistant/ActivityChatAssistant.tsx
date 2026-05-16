import ChatAssistantWidget, { type ChatAssistantWidgetProps } from "./ChatAssistantWidget";

export function ActivityChatAssistant(props: Omit<ChatAssistantWidgetProps, "mode">) {
  return <ChatAssistantWidget {...props} mode="activity" />;
}
