import { auth } from "@/auth"
import { SignOut } from "./signout-button"
import { Session } from "next-auth";
import axios from "axios";

export const Dashboard = async({session}: {
    session: Session
}) => {
    return (
        <div>
    <div className="flex justify-between">
        {session.user?.email}
        <SignOut />
    </div>
    <div className="my-5">
        <div className="text-5xl">Markets</div>
    </div>
    </div>
    )
}