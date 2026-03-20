import { signIn } from "@/auth";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { type VariantProps } from "class-variance-authority";
import { buttonVariants } from "./ui/button";

type SignInProps = {
  label?: string;
  className?: string;
} & VariantProps<typeof buttonVariants>;

export default function SignIn({
  label = "Log In",
  className,
  variant = "secondary",
  size = "lg",
}: SignInProps) {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("google", { redirectTo: "/" });
      }}
    >
      <Button
        size={size}
        variant={variant}
        type="submit"
        className={cn("shadow-none", className)}
      >
        {label}
      </Button>
    </form>
  );
}
