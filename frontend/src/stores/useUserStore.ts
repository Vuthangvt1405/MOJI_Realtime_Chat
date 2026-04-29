import { userService } from "@/services/userService";
import type { UserState } from "@/types/store";
import { create } from "zustand";
import { useAuthStore } from "./useAuthStore";
import { toast } from "sonner";
import { useChatStore } from "./useChatStore";

export const useUserStore = create<UserState>(() => ({
  updateAvatarUrl: async (formData) => {
    try {
      const { user, setUser } = useAuthStore.getState();
      const data = await userService.uploadAvatar(formData);

      if (user) {
        setUser({
          ...user,
          avatarUrl: data.avatarUrl,
        });

        useChatStore.getState().fetchConversations();
      }
    } catch (error) {
      console.error("Lỗi khi updateAvatarUrl", error);
      toast.error("Upload avatar không thành công!");
    }
  },

  updateProfile: async (data) => {
    try {
      const { user, setUser } = useAuthStore.getState();
      const updatedUser = await userService.updateProfile(data);

      if (user) {
        setUser({
          ...user,
          ...updatedUser,
        });
      }

      toast.success("Cập nhật hồ sơ thành công!");
    } catch (error) {
      console.error("Lỗi khi updateProfile", error);
      toast.error("Cập nhật hồ sơ thất bại!");
    }
  },
}));
