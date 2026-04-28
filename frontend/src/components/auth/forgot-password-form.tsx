import { useState } from "react";
import { isAxiosError } from "axios";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { authService } from "@/services/authService";
import { Label } from "../ui/label";

const forgotPasswordSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [successMessage, setSuccessMessage] = useState("");
  const [warningMessage, setWarningMessage] = useState("");
  const [submitError, setSubmitError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async ({ email }: ForgotPasswordFormValues) => {
    setSubmitError("");
    setSuccessMessage("");
    setWarningMessage("");

    try {
      const response = await authService.forgotPassword(email);

      if (response?.status === "warning") {
        setWarningMessage(
          response.message ||
            "Tài khoản này hiện chưa tồn tại trên hệ thống vui lòng kiểm tra lại email.",
        );
        return;
      }

      setSuccessMessage(
        response?.message ||
          "Nếu email tồn tại trong hệ thống, chúng tôi đã gửi liên kết đặt lại mật khẩu.",
      );
    } catch (error) {
      console.error(error);
      setSubmitError(
        isAxiosError<{ message?: string }>(error) && error.response?.data?.message
          ? error.response.data.message
          : "Không thể gửi yêu cầu lúc này. Vui lòng thử lại sau.",
      );
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

                <h1 className="text-2xl font-bold">Quên mật khẩu?</h1>
                <p className="text-muted-foreground text-balance">
                  Nhập email tài khoản Moji để nhận liên kết đặt lại mật khẩu.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <Label
                  htmlFor="email"
                  className="block text-sm"
                >
                  Email
                </Label>
                <Input
                  type="email"
                  id="email"
                  placeholder="m@gmail.com"
                  disabled={Boolean(successMessage)}
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-destructive text-sm">{errors.email.message}</p>
                )}
              </div>

              {successMessage && (
                <p className="rounded-md bg-green-100 p-3 text-sm text-green-700">
                  {successMessage}
                </p>
              )}

              {warningMessage && (
                <p className="rounded-md bg-red-100 p-3 text-sm text-red-700">{warningMessage}</p>
              )}

              {submitError && (
                <p className="text-destructive text-sm">{submitError}</p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting || Boolean(successMessage)}
              >
                Gửi liên kết đặt lại mật khẩu
              </Button>

              <div className="text-center text-sm">
                Nhớ mật khẩu?{" "}
                <a
                  href="/signin"
                  className="underline underline-offset-4"
                >
                  Đăng nhập
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
    </div>
  );
}
