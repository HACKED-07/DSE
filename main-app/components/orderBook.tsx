export const OrderBook = ({
  type,
  data,
  symbol,
}: {
  type: "buys" | "sells";
  data: any;
  symbol: string;
}) => {
  const side = type === "buys" ? "bids" : "asks";
  const maxQty = Math.max(...data.map((o: any) => o.remainingQty));
  return (
    <div className="text-xs">
      <div className="grid grid-cols-3 text-accent-foreground opacity-70 font-mono">
        <div>Price ({symbol.split("_")[1]})</div>
        <div>Qty ({symbol.split("_")[0]})</div>
        <div>Total ({symbol.split("_")[1]})</div>
      </div>
      {data.map((o: any) => (
        <div
          key={o.orderId}
          className={`relative grid grid-cols-3 text-muted-foreground max-w-full ${side === "bids" ? "bg-green-200" : "bg-red-200"}`}
        >
          <div
            className={`absolute inset-y-0 right-0 ${
              side === "bids" ? "bg-green-200" : "bg-red-200"
            } opacity-20`}
            style={{
              width: `${(o.remainingQty / maxQty) * 100}%`,
            }}
          />

          <div
            className={`${side === "bids" ? "text-green-400" : "text-red-400"}`}
          >
            {o.price}
          </div>
          <div>{o.remainingQty}</div>
          <div>{o.originalQty}</div>
        </div>
      ))}
    </div>
  );
};
