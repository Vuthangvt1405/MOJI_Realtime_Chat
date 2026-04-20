import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { UserPlus } from "lucide-react";
import type { User } from "@/types/user";
import { useFriendStore } from "@/stores/useFriendStore";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import SearchForm from "@/components/AddFriendModal/SearchForm";
import SendFriendRequestForm from "@/components/AddFriendModal/SendFriendRequestForm";

export interface IFormValues {
  username: string;
  message: string;
}

const AddFriendModal = () => {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searchedUsername, setSearchedUsername] = useState("");
  const { loading, searchByUsername, addFriend } = useFriendStore();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<IFormValues>({
    defaultValues: { username: "", message: "" },
  });

  const usernameValue = watch("username");

  const handleSearch = handleSubmit(async (data) => {
    const username = data.username.trim();
    if (!username) return;

    setSelectedUser(null);
    setSearchResults([]);
    setSearchedUsername(username);

    try {
      const users = await searchByUsername(username);
      setSearchResults(users);
    } catch (error) {
      console.error(error);
      setSearchResults([]);
    }
  });

  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
  };

  const handleSend = handleSubmit(async (data) => {
    if (!selectedUser) return;

    try {
      const message = await addFriend(selectedUser._id, data.message.trim());
      toast.success(message);

      handleCancel();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Lỗi xảy ra khi gửi kết bạn. Hãy thử lại";

      if (message === "Đã có lời mời kết bạn đang chờ") {
        toast.info(message);
        return;
      }

      toast.error(message);
      console.error("Lỗi xảy ra khi gửi request từ form", error);
    }
  });

  const handleCancel = () => {
    reset();
    setSearchedUsername("");
    setSelectedUser(null);
    setSearchResults([]);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <div className="flex justify-center items-center size-5 rounded-full hover:bg-sidebar-accent cursor-pointer z-10">
          <UserPlus className="size-4" />
          <span className="sr-only">Kết bạn</span>
        </div>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[425px] border-none">
        <DialogHeader>
          <DialogTitle>Kết Bạn</DialogTitle>
        </DialogHeader>

        {!selectedUser && (
          <>
            <SearchForm
              register={register}
              errors={errors}
              usernameValue={usernameValue}
              loading={loading}
              searchResults={searchResults}
              searchedUsername={searchedUsername}
              onSelectUser={handleSelectUser}
              onSubmit={handleSearch}
              onCancel={handleCancel}
            />
          </>
        )}

        {selectedUser && (
          <>
            <SendFriendRequestForm
              register={register}
              loading={loading}
              selectedUsername={selectedUser.username}
              onSubmit={handleSend}
              onBack={() => setSelectedUser(null)}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AddFriendModal;
