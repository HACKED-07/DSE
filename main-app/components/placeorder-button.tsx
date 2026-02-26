import { Button } from "./ui/button";

export const PlaceOrderButton = () => {
  return (
    <div className="flex justify-between">
      <Button
        size={"lg"}
        className="bg-green-600 hover:bg-green-500 hover:cursor-pointer w-1/2"
      >
        BUY
      </Button>
      <Button
        size={"lg"}
        className="w-1/2 bg-red-600 hover:bg-red-500 hover:cursor-pointer"
      >
        SELL
      </Button>
    </div>
  );
};
