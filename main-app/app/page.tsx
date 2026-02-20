import { auth } from "@/auth";
import { Dashboard } from "@/components/Dashboard";
import { Landing } from "@/components/Landing";
import SignIn from "@/components/sign-in";
import axios from "axios";
import { cookies } from "next/headers";

export default async function Home() {
  const session = await auth();
  if(!session?.user) {
    return (
      <Landing />
    )
  } else {
    console.log(session.user.id)
    return (
    <Dashboard session={session} />
  )
  }
}
