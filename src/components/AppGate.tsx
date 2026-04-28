"use client";

import { useState, useEffect } from "react";
import { Analytics } from "@vercel/analytics/next";

const STORAGE_KEY = "dr_dxb_app_unlocked";

export function AppGate({ children }: { children: React.ReactNode }) {
  return <>{children}<Analytics /></>;
}
