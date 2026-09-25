interface PlateProps {
  readonly plate: string;
}

/** A plate that looks like one, so the person spots the car (S03). */
export function Plate({ plate }: PlateProps) {
  return (
    <span
      aria-label={`Placa ${plate}`}
      className="inline-flex min-w-32 flex-col overflow-hidden rounded-[7px] border-2 border-[#14151d] bg-[#ffffff] text-center text-[#14151d]"
    >
      <span
        aria-hidden
        className="bg-[#23408e] py-[3px] text-[8px] leading-none font-extrabold tracking-[0.18em] text-[#ffffff]"
      >
        BRASIL
      </span>
      <span className="px-2.5 pt-[5px] pb-1.5 font-mono text-[23px] leading-none font-bold tracking-[0.1em]">
        {plate}
      </span>
    </span>
  );
}
