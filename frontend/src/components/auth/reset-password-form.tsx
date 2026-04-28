import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { authService } from "@/services/authService";
import { useAuthStore } from "@/stores/useAuthStore";
import { Label } from "../ui/label";

const resetPasswordSchema = z
  .object({
    newPassword: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự"),
    confirmPassword: z.string().min(6, "Mật khẩu xác nhận phải có ít nhất 6 ký tự"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmPassword"],
  });

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const clearState = useAuthStore((state) => state.clearState);
  const token = searchParams.get("token") || "";
  const [submitError, setSubmitError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async ({ newPassword }: ResetPasswordFormValues) => {
    if (!token) return;

    setSubmitError("");

    try {
      await authService.resetPassword(token, newPassword);
      clearState();
      toast.success("Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.");
      navigate("/signin", { replace: true });
    } catch (error) {
      console.error(error);
      setSubmitError("Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.");
    }
  };

  return (
    <div
      className={cn("flex flex-col gap-6", className)}
      {...props}
    >
      <Card className="overflow-hidden p-0 border-border">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form
            className="p-6 md:p-8"
            onSubmit={handleSubmit(onSubmit)}
          >
            <div className="flex flex-col gap-6">
              <div className="flex flex-col items-center text-center gap-2">
                <a
                  href="/"
                  className="mx-auto block w-fit text-center"
                >
                  <img
                    src="/logo.svg"
                    alt="logo"
                  />
                </a>

                <h1 className="text-2xl font-bold">Đặt lại mật khẩu</h1>
                <p className="text-muted-foreground text-balance">
                  Tạo mật khẩu mới cho tài khoản Moji của bạn.
                </p>
              </div>

              {!token ? (
                <div className="flex flex-col gap-4 text-center">
                  <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                    Liên kết đặt lại mật khẩu không hợp lệ. Vui lòng yêu cầu liên kết mới.
                  </p>
                  <Button
                    type="button"
                    onClick={() => navigate("/forgot-password")}
                  >
                    Yêu cầu liên kết mới
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-3">
                    <Label
                      htmlFor="newPassword"
                      className="block text-sm"
                    >
                      Mật khẩu mới
                    </Label>
                    <Input
                      type="password"
                      id="newPassword"
                      {...register("newPassword")}
                    />
                    {errors.newPassword && (
                      <p className="text-destructive text-sm">
                        {errors.newPassword.message}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-3">
                    <Label
                      htmlFor="confirmPassword"
                      className="block text-sm"
                    >
                      Xác nhận mật khẩu mới
                    </Label>
                    <Input
                      type="password"
                      id="confirmPassword"
                      {...register("confirmPassword")}
                    />
                    {errors.confirmPassword && (
                      <p className="text-destructive text-sm">
                        {errors.confirmPassword.message}
                      </p>
                    )}
                  </div>

                  {submitError && (
                    <p className="text-destructive text-sm">{submitError}</p>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    Đặt lại mật khẩu
                  </Button>
                </>
              )}

              <div className="text-center text-sm">
                Quay lại{" "}
                <a
                  href="/signin"
                  className="underline underline-offset-4"
                >
                  đăng nhập
                </a>
              </div>
            </div>
          </form>
          <div className="bg-muted relative hidden md:block">
            <img
              src="/placeholder.png"
              alt="Image"
              className="absolute top-1/2 -translate-y-1/2 object-cover"
            />
          </div>
        </CardContent>
      </Card>
      <div className=" text-xs text-balance px-6 text-center *:[a]:hover:text-primary text-muted-foreground *:[a]:underline *:[a]:underline-offetset-4">
        Sau khi đặt lại mật khẩu, các phiên đăng nhập cũ sẽ bị thu hồi.
      </div>
    </div>
  );
}
