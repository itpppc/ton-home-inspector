/**
 * TON AI SERVICE TECH — developer credit shown in every TON AI product (UI footer, login, About,
 * PDF report, Excel). Single source of truth: change it here and every surface follows.
 * Logo file: /public/brand/ton-ai-logo.svg (swap in the official file when available, same path).
 */
export const TON_AI = {
  name: "TON AI SERVICE TECH",
  url: "https://ton-ai-tech.web.app/",
  host: "ton-ai-tech.web.app",
  slogan: "INSIGHT · AUTOMATE · GROW",
  logo: "/brand/ton-ai-logo.svg",
  /** First year of the product, Buddhist Era. */
  sinceBE: 2569,
} as const;

/** "© 2569 TON AI SERVICE TECH · สงวนลิขสิทธิ์", or "© 2569–2570 …" once the year rolls over. */
export function tonAiCopyright(now: Date = new Date()): string {
  const be = now.getFullYear() + 543;
  const years = be > TON_AI.sinceBE ? `${TON_AI.sinceBE}–${be}` : `${TON_AI.sinceBE}`;
  return `© ${years} ${TON_AI.name} · สงวนลิขสิทธิ์`;
}

export const TON_AI_CREDIT_TEXT = `พัฒนาและออกแบบโดย ${TON_AI.name} · ${TON_AI.host}`;
