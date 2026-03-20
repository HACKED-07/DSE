"use client";

import { useEffect } from "react";
import { io } from "socket.io-client";

export const SocketConnection = () => {
  useEffect(() => {
    const socket = io("http://localhost:3002");

    socket.on("connect", () => {
      console.log("connected: ", socket.id);
      socket.emit("subscribe", "BTC/USDT");
    });

    socket.on("update", (payload) => {
      console.log("payload: ", payload);
    });

    socket.on("connect_error", (error) => {
      console.error("socket connection error:", error.message);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return null;
};
