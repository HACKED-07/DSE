import axios from "axios";

export default async function Home() {
  const market = await axios.get("http://localhost:3002/markets/BTC_USDT");
  console.log(market.data);
  return (
    <div>
      <label htmlFor="userId">User Id: </label>
      <input type="text" id="userId" />
      <label htmlFor="price">Price: </label>
      <input type="text" id="price" />
      <label htmlFor="qty">Quantity: </label>
      <input type="text" id="qty" />
      <label htmlFor="asset">Asset: </label>
      <input type="text" id="asset" />
      <button>Buy</button>
      <button>Sell</button>
      <button>cancel</button>
    </div>
  );
}
