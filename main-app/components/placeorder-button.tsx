import { Button } from "./ui/button";

export const PlaceOrderButton = () => {
  return (
    <div className="flex justify-between gap-3">
      <Button
        size={"lg"}
        className="w-1/2 rounded-2xl bg-emerald-500 text-white hover:cursor-pointer hover:bg-emerald-400"
      >
        BUY
      </Button>
      <Button
        size={"lg"}
        className="w-1/2 rounded-2xl bg-rose-500 text-white hover:cursor-pointer hover:bg-rose-400"
      >
        SELL
      </Button>
    </div>
  );
};
