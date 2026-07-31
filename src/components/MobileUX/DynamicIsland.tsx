"use client";

export type IslandNotification = {
  id: string;
  title: string;
  message?: string;
  type: "success" | "error" | "info" | "loading";
  duration?: number;
};

type NotifyFunction = (
  title: string,
  options?: { message?: string; type?: IslandNotification["type"]; duration?: number }
) => string;

class IslandEventManager {
  subscribe() { return () => {}; }
  notify() {}
  dismiss() {}
}

export const dynamicIslandManager = new IslandEventManager();

export const showIsland: NotifyFunction = () => "";
export const dismissIsland = () => {};

export function DynamicIsland() {
  return null;
}
