export type TextExportResult = "copied" | "shared" | "failed";

export async function copyText(text: string): Promise<TextExportResult> {
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}

/** The system share sheet, where there is one (iOS). Falls back to the clipboard. */
export async function shareText(title: string, text: string): Promise<TextExportResult> {
  if (!("share" in navigator)) return copyText(text);
  try {
    await navigator.share({ title, text });
    return "shared";
  } catch {
    return "failed";
  }
}
