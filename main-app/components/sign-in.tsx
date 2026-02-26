import { signIn } from "@/auth";
import { Button } from "./ui/button";

export default function SignIn() {
  return (
    <form
      action={async () => {
        "use server";
        await signIn("google", { redirectTo: "/" });
      }}
    >
      <Button size={"lg"} type="submit" className="shadow-lg shadow-black/5">
        SignIn
      </Button>
    </form>
  );
}
