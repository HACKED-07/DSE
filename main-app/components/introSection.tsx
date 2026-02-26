import { Button } from "./ui/button";

export const IntroSection = () => {
  return (
    <div className="h-screen flex items-center">
      <div className="max-w-7xl mx-auto w-full px-6 flex items-center justify-between gap-12">
        <div>
          <div className="text-8xl font-semibold tracking-tighter mb-4">
            The future of finance is here.
          </div>
          <div className="text-xl mb-3">
            Buy, sell and trade crypto on a platform you can trust.
          </div>
          <Button size={"lg"}>Sign Up</Button>
        </div>
        <div className="w-8/12 border-0 bg-zinc-200 rounded-3xl py-4 px-28">
          <img
            src={
              "https://images.ctfassets.net/o10es7wu5gm1/NwN4qP0kizrOvWSJm9fhC/900e0f0eb28c040f6bcafb74cdf4f4a8/Group_1547769260__1_.png?fm=avif&w=1200&h=2223&q=65"
            }
            alt="Screenshot of a image of the mobile UI"
          />
        </div>
      </div>
    </div>
  );
};
