import { friendService } from "@/services/friendService";
import type { FriendState } from "@/types/store";
import { create } from "zustand";

const getErrorMessage = (error: unknown, fallbackMessage: string) => {
  if (typeof error === "object" && error !== null) {
    const apiError = error as {
      response?: { data?: { message?: string } };
      message?: string;
    };

    if (apiError.response?.data?.message) {
      return apiError.response.data.message;
    }

    if (apiError.message) {
      return apiError.message;
    }
  }

  return fallbackMessage;
};

export const useFriendStore = create<FriendState>((set) => ({
  friends: [],
  friendsLoaded: false,
  loading: false,
  receivedList: [],
  sentList: [],
  searchByUsername: async (username) => {
    try {
      set({ loading: true });

      const users = await friendService.searchByUsername(username);

      return users;
    } catch (error) {
      console.error("Lỗi xảy ra khi tìm user bằng username", error);
      return [];
    } finally {
      set({ loading: false });
    }
  },
  addFriend: async (to, message) => {
    try {
      set({ loading: true });
      const resultMessage = await friendService.sendFriendRequest(to, message);
      return resultMessage;
    } catch (error) {
      console.error("Lỗi xảy ra khi addFriend", error);
      throw new Error(
        getErrorMessage(error, "Lỗi xảy ra khi gửi kết bạn. Hãy thử lại")
      );
    } finally {
      set({ loading: false });
    }
  },
  getAllFriendRequests: async () => {
    try {
      set({ loading: true });

      const result = await friendService.getAllFriendRequest();

      if (!result) return;

      const { received, sent } = result;

      set({ receivedList: received, sentList: sent });
    } catch (error) {
      console.error("Lỗi xảy ra khi getAllFriendRequests", error);
    } finally {
      set({ loading: false });
    }
  },
  acceptRequest: async (requestId) => {
    try {
      set({ loading: true });
      const newFriend = await friendService.acceptRequest(requestId);

      set((state) => ({
        receivedList: state.receivedList.filter((r) => r._id !== requestId),
        friends: newFriend
          ? state.friends.some((friend) => friend._id === newFriend._id)
            ? state.friends
            : [newFriend, ...state.friends]
          : state.friends,
      }));
    } catch (error) {
      console.error("Lỗi xảy ra khi acceptRequest", error);
      throw new Error(
        getErrorMessage(error, "Lỗi xảy ra khi chấp nhận kết bạn. Hãy thử lại")
      );
    } finally {
      set({ loading: false });
    }
  },
  declineRequest: async (requestId) => {
    try {
      set({ loading: true });
      await friendService.declineRequest(requestId);

      set((state) => ({
        receivedList: state.receivedList.filter((r) => r._id !== requestId),
      }));
    } catch (error) {
      console.error("Lỗi xảy ra khi declineRequest", error);
    } finally {
      set({ loading: false });
    }
  },
  getFriends: async () => {
    try {
      set({ loading: true });
      const friends = await friendService.getFriendList();
      set({ friends, friendsLoaded: true });
    } catch (error) {
      console.error("Lỗi xảy ra khi load friends", error);
      set({ friends: [], friendsLoaded: true });
    } finally {
      set({ loading: false });
    }
  },
  deleteFriend: async (friendId) => {
    try {
      set({ loading: true });
      await friendService.deleteFriend(friendId);

      set((state) => ({
        friends: state.friends.filter((friend) => friend._id !== friendId),
      }));
    } catch (error) {
      console.error("Lỗi xảy ra khi deleteFriend", error);
      throw new Error(getErrorMessage(error, "Lỗi xảy ra khi xóa bạn. Hãy thử lại"));
    } finally {
      set({ loading: false });
    }
  },
}));
