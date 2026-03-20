"use client";

import {
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  createChart,
  Time,
} from "lightweight-charts";
import { useEffect, useRef } from "react";

type Candle = {
  bucket: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export function Chart({ data }: { data: Candle[] }) {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        textColor: "#52525b",
        // @ts-expect-error lightweight-charts' Background type is narrower than runtime support here.
        background: { type: "solid", color: "white" },
      },
      grid: {
        vertLines: { color: "#f4f4f5" },
        horzLines: { color: "#f4f4f5" },
      },
      rightPriceScale: {
        borderColor: "#e4e4e7",
      },
      timeScale: {
        borderColor: "#e4e4e7",
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      const { width, height } = entry.contentRect;
      chart.applyOptions({
        width,
        height,
      });
    });

    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      seriesRef.current = null;
      chartRef.current = null;
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;

    const formattedData = data.map((candle) => ({
      time: (candle.bucket / 1000) as Time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }));

    seriesRef.current.setData(formattedData);
    chartRef.current.timeScale().fitContent();
  }, [data]);

  return <div ref={chartContainerRef} className="h-full min-h-[680px] w-full" />;
}
