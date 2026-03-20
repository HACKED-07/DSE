import { signOut } from "@/auth";
import { cn } from "@/lib/utils";
import { type VariantProps } from "class-variance-authority";
import { Button, buttonVariants } from "./ui/button";

type SignOutProps = {
  label?: string;
  className?: string;
} & VariantProps<typeof buttonVariants>;

export function SignOut({
  label = "Sign Out",
  className,
  variant = "outline",
  size = "default",
}: SignOutProps) {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    >
      <Button
        type="submit"
        variant={variant}
        size={size}
        className={cn(className)}
      >
        {label}
      </Button>
    </form>
  );
}
