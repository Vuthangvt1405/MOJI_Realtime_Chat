import { create } from "zustand";
import { toast } from "sonner";
import { authService } from "@/services/authService";
import type { AuthState } from "@/types/store";
import { persist } from "zustand/middleware";
import { useChatStore } from "./useChatStore";

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      user: null,
      loading: false,

      /**
       * Purpose:
       * Stores the JWT access token in auth state.
       *
       * How it works:
       * Sets accessToken in Zustand store (persisted by middleware).
       *
       * Parameters:
       * - accessToken: JWT string
       *
       * Returns:
       * void
       */
      setAccessToken: (accessToken) => {
        set({ accessToken });
      },
      /**
       * Purpose:
       * Stores the authenticated user object in auth state.
       *
       * How it works:
       * Sets user object in Zustand store (persisted by middleware).
       *
       * Parameters:
       * - user: User object with _id, username, etc.
       *
       * Returns:
       * void
       */
      setUser: (user) => {
        set({ user });
      },
      /**
       * Purpose:
       * Clears all auth and chat state on logout/token expiry.
       *
       * How it works:
       * Resets auth state to null, resets chat store, clears
       * localStorage and sessionStorage.
       *
       * Parameters:
       * none
       *
       * Returns:
       * void
       */
      clearState: () => {
        set({ accessToken: null, user: null, loading: false });
        useChatStore.getState().reset();
        localStorage.clear();
        sessionStorage.clear();
      },
      /**
       * Purpose:
       * Registers a new user account.
       *
       * How it works:
       * Calls authService.signUp with registration fields, shows success toast.
       *
       * Parameters:
       * - username: desired username
       * - password: password string
       * - email: email address
       * - firstName: user's first name
       * - lastName: user's last name
       *
       * Returns:
       * Promise<void>
       */
      signUp: async (username, password, email, firstName, lastName) => {
        try {
          set({ loading: true });

          //  gọi api
          await authService.signUp(username, password, email, firstName, lastName);

          toast.success(
            "Đăng ký thành công! Bạn sẽ được chuyển sang trang đăng nhập."
          );
        } catch (error) {
          console.error(error);
          toast.error("Đăng ký không thành công");
        } finally {
          set({ loading: false });
        }
      },
      /**
       * Purpose:
       * Authenticates the user and loads initial chat data.
       *
       * How it works:
       * Clears state, calls authService.signIn, stores token, fetches user
       * profile (fetchMe), then loads conversations (fetchConversations).
       *
       * Parameters:
       * - username: username string
       * - password: password string
       *
       * Returns:
       * Promise<void>
       */
      signIn: async (username, password) => {
        try {
          get().clearState();
          set({ loading: true });

          const { accessToken } = await authService.signIn(username, password);
          get().setAccessToken(accessToken);

          await get().fetchMe();
          useChatStore.getState().fetchConversations();

          toast.success("Chào mừng bạn quay lại với Moji 🎉");
        } catch (error) {
          console.error(error);
          toast.error("Đăng nhập không thành công!");
        } finally {
          set({ loading: false });
        }
      },
      /**
       * Purpose:
       * Logs the user out and clears all local state.
       *
       * How it works:
       * Calls clearState, then authService.signOut, shows success toast.
       *
       * Parameters:
       * none
       *
       * Returns:
       * Promise<void>
       */
      signOut: async () => {
        try {
          get().clearState();
          await authService.signOut();
          toast.success("Logout thành công!");
        } catch (error) {
          console.error(error);
          toast.error("Lỗi xảy ra khi logout. Hãy thử lại!");
        }
      },
      /**
       * Purpose:
       * Fetches the authenticated user's profile from the API.
       *
       * How it works:
       * Calls authService.fetchMe, stores user in state, clears auth on error.
       *
       * Parameters:
       * none
       *
       * Returns:
       * Promise<void>
       */
      fetchMe: async () => {
        try {
          set({ loading: true });
          const user = await authService.fetchMe();

          set({ user });
        } catch (error) {
          console.error(error);
          set({ user: null, accessToken: null });
          toast.error("Lỗi xảy ra khi lấy dữ liệu người dùng. Hãy thử lại!");
        } finally {
          set({ loading: false });
        }
      },
      /**
       * Purpose:
       * Refreshes the JWT access token using the refresh token cookie.
       *
       * How it works:
       * Calls authService.refresh to get new access token, stores it,
       * fetches user profile if not yet loaded, clears state on failure.
       *
       * Parameters:
       * none
       *
       * Returns:
       * Promise<void>
       */
      refresh: async () => {
        try {
          set({ loading: true });
          const { user, fetchMe, setAccessToken } = get();
          const accessToken = await authService.refresh();

          setAccessToken(accessToken);

          if (!user) {
            await fetchMe();
          }
        } catch (error) {
          console.error(error);
          toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại!");
          get().clearState();
        } finally {
          set({ loading: false });
        }
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({ user: state.user }), // chỉ persist user
    }
  )
);
