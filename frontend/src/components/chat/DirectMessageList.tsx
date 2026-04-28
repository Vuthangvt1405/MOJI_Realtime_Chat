import { useChatStore } from "@/stores/useChatStore";
import { useFriendStore } from "@/stores/useFriendStore";
import { useEffect, useState } from "react";
import DirectMessageCard from "./DirectMessageCard";

const DirectMessageList = () => {
  const { conversations } = useChatStore();
  const { getFriends } = useFriendStore();
  const [friendsReady, setFriendsReady] = useState(false);

  useEffect(() => {
    let active = true;

    const loadFriends = async () => {
      await getFriends();

      if (active) {
        setFriendsReady(true);
      }
    };

    loadFriends();

    return () => {
      active = false;
    };
  }, [getFriends]);

  if (!conversations) return;

  const directConversations = conversations.filter(
    (convo) => convo.type === "direct"
  );

  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-2">
      {directConversations.map((convo) => (
        <DirectMessageCard
          convo={convo}
          key={convo._id}
          friendsReady={friendsReady}
        />
      ))}
    </div>
  );
};

export default DirectMessageList;
