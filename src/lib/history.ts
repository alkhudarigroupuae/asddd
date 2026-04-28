"use client";

import type { DeploymentRecord, VendorRecord } from "@/types";

const STORAGE_KEY = "dr-dxb-server-deployments";
const VENDOR_STORAGE_KEY = "dr-dxb-vendor-deployments";
const MAX_ITEMS = 50;
const MAX_VENDOR_ITEMS = 30;

export function getDeploymentHistory(): DeploymentRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DeploymentRecord[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_ITEMS) : [];
  } catch {
    return [];
  }
}

export function addDeployment(record: DeploymentRecord): void {
  const history = getDeploymentHistory();
  history.unshift(record);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, MAX_ITEMS)));
  } catch {
    // ignore quota or parse errors
  }
}

export function updateDeploymentLabel(contractAddress: string, label: string): void {
  const history = getDeploymentHistory();
  const idx = history.findIndex((r) => r.contractAddress === contractAddress);
  if (idx === -1) return;
  history[idx] = { ...history[idx], label: label.trim() || undefined };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, MAX_ITEMS)));
  } catch {
    // ignore
  }
}

export function getVendorHistory(): VendorRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(VENDOR_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as VendorRecord[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_VENDOR_ITEMS) : [];
  } catch {
    return [];
  }
}

export function addVendorDeployment(record: VendorRecord): void {
  const history = getVendorHistory();
  history.unshift(record);
  try {
    localStorage.setItem(VENDOR_STORAGE_KEY, JSON.stringify(history.slice(0, MAX_VENDOR_ITEMS)));
  } catch {
    // ignore
  }
}

/** Clear all deployment and vendor history for a clean dashboard. */
export function clearAllHistory(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(VENDOR_STORAGE_KEY);
  } catch {
    // ignore
  }
}
