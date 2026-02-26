"use client";

import { CandlestickSeries, createChart, Time } from "lightweight-charts";
import { useEffect, useRef } from "react";

export function Chart({ data }: { data: any[] }) {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!chartContainerRef.current) return;
    const chart = createChart(chartContainerRef.current, {
      layout: {
        textColor: "white",
        // @ts-ignore
        background: { type: "solid", color: "white" },
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    async function getData() {
      const formattedData = data.map((candle: any) => ({
        time: (candle.bucket / 1000) as Time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      }));
      series.setData(formattedData);
      chart.timeScale().fitContent();
    }
    getData();

    return () => chart.remove();
  }, []);

  return <div ref={chartContainerRef} className="w-full"></div>;
}
