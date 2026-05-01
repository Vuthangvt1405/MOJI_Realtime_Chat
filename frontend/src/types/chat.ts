export interface Participant {
  _id: string;
  displayName: string;
  avatarUrl?: string | null;
  joinedAt: string;
}

export interface SeenUser {
  _id: string;
  displayName?: string;
  avatarUrl?: string | null;
}

export interface Group {
  name: string;
  createdBy: string;
}

export interface LastMessage {
  _id: string;
  content: string;
  createdAt: string;
  sender: {
    _id: string;
    displayName: string;
    avatarUrl?: string | null;
  };
}

export interface Conversation {
  _id: string;
  type: "direct" | "group";
  group: Group;
  participants: Participant[];
  lastMessageAt: string;
  seenBy: SeenUser[];
  lastMessage: LastMessage | null;
  unreadCounts: Record<string, number>; // key = userId, value = unread count
  createdAt: string;
  updatedAt: string;
}

export interface ConversationResponse {
  conversations: Conversation[];
}

export type MessageReactionEmoji = "👍" | "❤️" | "😂" | "😮" | "😢" | "🔥";

export interface MessageReactionUser {
  _id: string;
  username?: string;
  displayName: string;
  avatarUrl?: string | null;
}

export interface MessageReactionSummary {
  emoji: MessageReactionEmoji | string;
  count: number;
  reactedByMe: boolean;
  users: MessageReactionUser[];
}

export interface MessageReactionUpdate {
  messageId: string;
  conversationId: string;
  reactions: MessageReactionSummary[];
  conversation?: {
    _id: string;
    lastMessage: {
      _id: string;
      content: string | null;
      senderId?: string;
      createdAt: string;
    };
    lastMessageAt: string;
  };
  unreadCounts?: Record<string, number>;
}

export interface Message {
  _id: string;
  conversationId: string;
  senderId: string;
  content: string | null;
  imgUrl?: string | null;
  imgUrls?: string[];
  updatedAt?: string | null;
  createdAt: string;
  isOwn?: boolean;
  reactions?: MessageReactionSummary[];
}
