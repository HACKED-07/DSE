"use client";
import React, { useState } from "react";
import { Button } from "./ui/button";

export const NavbarButton = ({ children }: { children: React.ReactNode }) => {
  const [isMouse, setIsMouse] = useState(false);
  return (
    <div>
      <Button
        variant={"ghost"}
        onMouseEnter={() => {
          setIsMouse(true);
        }}
        onMouseLeave={() => {
          setIsMouse(false);
        }}
        className={`${isMouse ? "cursor-pointer" : ""} rounded-full font-bold text-md`}
      >
        {children}
      </Button>
    </div>
  );
};
