import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiJson } from "../api";

export type PublicSettings = {
  lang_target: string;
  lang_ui: string;
  lang_target_locale: string;
  cefr_level: string;
  tts_voice_target: string;
  tts_voice_ui: string;
  llm_model: string;
  has_fast_model: boolean;
  has_strong_model: boolean;
};

const SettingsContext = createContext<PublicSettings | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  useEffect(() => {
    void apiJson<PublicSettings>("/api/settings/public").then(setSettings).catch(() => {});
  }, []);
  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>;
}

export function usePublicSettings() {
  return useContext(SettingsContext);
}
