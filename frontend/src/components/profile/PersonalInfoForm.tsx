import { Heart } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useUserStore } from "@/stores/useUserStore";
import type { User } from "@/types/user";

const profileSchema = z.object({
  displayName: z.string().min(1, "Tên hiển thị không được để trống"),
  email: z.string().email("Email không hợp lệ"),
  phone: z.string().optional(),
  bio: z.string().max(500, "Giới thiệu không được vượt quá 500 ký tự").optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

type Props = {
  userInfo: User | null;
};

const PersonalInfoForm = ({ userInfo }: Props) => {
  const { updateProfile } = useUserStore();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    values: {
      displayName: userInfo?.displayName ?? "",
      email: userInfo?.email ?? "",
      phone: userInfo?.phone ?? "",
      bio: userInfo?.bio ?? "",
    },
  });

  if (!userInfo) return null;

  const onSubmit = async (data: ProfileFormValues) => {
    await updateProfile(data);
  };

  return (
    <Card className="glass-strong border-border/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="size-5 text-primary" />
          Thông tin cá nhân
        </CardTitle>
        <CardDescription>
          Cập nhật chi tiết cá nhân và thông tin hồ sơ của bạn
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Tên hiển thị</Label>
              <Input
                id="displayName"
                {...register("displayName")}
                className="glass-light border-border/30"
              />
              {errors.displayName && (
                <p className="text-destructive text-sm">{errors.displayName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Tên người dùng</Label>
              <Input
                id="username"
                type="text"
                value={userInfo.username}
                disabled
                className="glass-light border-border/30 opacity-60"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...register("email")}
                className="glass-light border-border/30"
              />
              {errors.email && (
                <p className="text-destructive text-sm">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Số điện thoại</Label>
              <Input
                id="phone"
                type="text"
                {...register("phone")}
                className="glass-light border-border/30"
              />
            </div>
          </div>

          <div className="space-y-2 mt-4">
            <Label htmlFor="bio">Giới thiệu</Label>
            <Textarea
              id="bio"
              rows={3}
              {...register("bio")}
              className="glass-light border-border/30 resize-none"
            />
            {errors.bio && (
              <p className="text-destructive text-sm">{errors.bio.message}</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full md:w-auto bg-gradient-primary hover:opacity-90 transition-opacity mt-4"
          >
            Lưu thay đổi
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default PersonalInfoForm;
