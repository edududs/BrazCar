import { useTheme } from "../app/use-theme";
import type { ThemePreference } from "../domain/theme";
import { Icon } from "./icon";
import { Segmented, type SegmentedOption } from "./segmented";

const options: readonly SegmentedOption<ThemePreference>[] = [
  { value: "system", label: "Sistema", icon: <Icon name="auto" size={16} /> },
  { value: "light", label: "Claro", icon: <Icon name="sun" size={16} /> },
  { value: "dark", label: "Escuro", icon: <Icon name="moon" size={16} /> },
];

/** The "Aparência" group of the account screen: follow the device, or pick a theme. */
export function ThemeControl() {
  const theme = useTheme();
  return (
    <section className="flex flex-col gap-2">
      <h2 className="mx-1 text-label font-bold tracking-[0.08em] text-ink-3 uppercase">
        Aparência
      </h2>
      <Segmented label="Tema" options={options} value={theme.preference} onChange={theme.set} />
    </section>
  );
}
