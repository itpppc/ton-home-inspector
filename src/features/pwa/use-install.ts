"use client";
import * as React from "react";
import { canPrompt, currentEnv, promptInstall, subscribe, wasInstalled, type Env } from "./install-state";

export interface InstallState {
  env: Env | null;
  /** Native install dialog is available (Android Chrome, Edge, Samsung, desktop Chromium). */
  canPrompt: boolean;
  installed: boolean;
  install: () => Promise<boolean>;
}

export function useInstall(): InstallState {
  const [env, setEnv] = React.useState<Env | null>(null); // client-only: avoids hydration mismatch
  const [, force] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => {
    setEnv(currentEnv());
    return subscribe(force);
  }, []);
  return {
    env,
    canPrompt: canPrompt(),
    installed: wasInstalled() || !!env?.standalone,
    install: promptInstall,
  };
}
