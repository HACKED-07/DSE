import { NavbarButton } from "./navbar-button";
import SignIn from "./sign-in";
import { Button } from "./ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./ui/hover-card";

export const Navbar = () => {
  return (
    <div className="flex justify-evenly shadow-sm backdrop-blur-xl items-center bg-white/70">
      <div className="flex flex-none pt-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 200 60"
          width="250"
          height="70"
        >
          <polygon
            points="18,8 30,1 42,8 42,22 30,29 18,22"
            fill="none"
            stroke="#111"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />

          <text
            x="54"
            y="22"
            fontFamily="Georgia, serif"
            fontSize="20"
            fontWeight="700"
            letterSpacing="3"
            fill="#111"
          >
            DSE
          </text>

          <line
            x1="54"
            y1="27"
            x2="128"
            y2="27"
            stroke="#111"
            strokeWidth="0.8"
          />

          <text
            x="54"
            y="40"
            fontFamily="'Helvetica Neue', Helvetica, sans-serif"
            fontSize="7"
            letterSpacing="3.5"
            fill="#999"
          >
            EXCHANGE
          </text>
        </svg>
      </div>
      <div className="mr-5 hidden lg:block">
        <div className="flex">
          <NavbarButtonGroup />
        </div>
      </div>
      <div className="flex gap-2">
        <SignIn />
        <Button
          variant={"secondary"}
          color="red"
          unselectable="on"
          className="bg-zinc-200"
          size={"lg"}
        >
          Sign Up
        </Button>
        <Button className="block lg:hidden">menues</Button>
      </div>
    </div>
  );
};

function NavbarButtonGroup() {
  return (
    <>
      <HoverCard>
        <HoverCardTrigger>
          <NavbarButton>Cryptocurriences</NavbarButton>
        </HoverCardTrigger>
        <HoverCardContent>This is the content</HoverCardContent>
      </HoverCard>
      <NavbarButton>Individuals</NavbarButton>
      <NavbarButton>Businesses</NavbarButton>
      <NavbarButton>Institutions</NavbarButton>
      <NavbarButton>Developers</NavbarButton>
      <NavbarButton>Company</NavbarButton>
    </>
  );
}
