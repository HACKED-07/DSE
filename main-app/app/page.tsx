import { auth } from "@/auth";
import { Dashboard } from "@/components/Dashboard";
import { Landing } from "@/components/Landing";

export default async function Home() {
  const session = await auth();
  if (!session?.user) {
    return <Landing />;
  } else {
    console.log(session.user.id);
    return (
      <div>
        <Dashboard session={session} />
      </div>
    );
  }
}
