import { useParams } from "react-router-dom";
import { ChatWorkspace } from "../components/chat/ChatWorkspace";

export default function ChatRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  return <ChatWorkspace selectedRoomId={roomId} />;
}
