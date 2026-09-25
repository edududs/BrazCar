import { type Page, expect } from "@playwright/test";

/**
 * Chooses when a ride leaves the way the person does (F7): opens the day, picks it on the
 * calendar, types the hour and the minutes, and confirms. `local` is "YYYY-MM-DDTHH:mm" in the
 * browser's zone, the same shape `localInput` builds.
 */
export async function chooseDeparture(page: Page, local: string): Promise<void> {
  const [day, clock] = local.split("T") as [string, string];
  const [hour, minute] = clock.split(":") as [string, string];
  const dayNumber = String(Number(day.slice(8, 10)));

  await page.getByRole("button", { name: /^Dia:/ }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();

  // The calendar reaches any day; the cards only the next four. Months roll forward as needed.
  // On an edit the day is locked and the calendar too: only the clock is set (ADR-0004).
  const other = sheet.getByRole("button", { name: "Outro dia" });
  if (await other.isEnabled()) {
    if ((await other.getAttribute("aria-pressed")) !== "true") await other.click();
    const grid = sheet.getByRole("grid");
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const title = (await grid.getAttribute("aria-label")) ?? "";
      if (monthOf(title) === Number(day.slice(5, 7))) break;
      await sheet.getByRole("button", { name: "Próximo mês" }).click();
    }
    await grid.getByRole("button", { name: dayNumber, exact: true }).click();
  }

  // Typed key by key, the way a person does: `fill` would replace the value at once and hide
  // any trouble with typing digit by digit (that is how a broken hour field once passed).
  await sheet.getByLabel("Hora", { exact: true }).click();
  await page.keyboard.type(`${hour}${minute}`, { delay: 30 });
  await expect(sheet.getByLabel("Hora", { exact: true })).toHaveValue(hour);
  await expect(sheet.getByLabel("Minutos", { exact: true })).toHaveValue(minute);
  await sheet.getByRole("button", { name: "Pronto" }).click();
  await expect(sheet).toBeHidden();
}

const months = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** "Setembro de 2026" → 9. */
function monthOf(title: string): number {
  return months.indexOf(title.split(" ")[0]?.toLowerCase() ?? "") + 1;
}
