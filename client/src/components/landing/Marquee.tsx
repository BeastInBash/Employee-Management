import { Feather } from "lucide-react";

const KINDS = [
  "Cafés and restaurants",
  "Design studios",
  "Early-stage startups",
  "Retail shops",
  "Agencies",
  "Clinics",
  "Workshops",
  "Remote teams",
  "Bakeries",
  "Repair shops",
];

const Row = ({ hidden }: { hidden?: boolean }) => (
  <ul
    className="flex shrink-0 items-center motion-reduce:shrink motion-reduce:flex-wrap motion-reduce:gap-y-2"
    aria-hidden={hidden}
  >
    {KINDS.map((k) => (
      <li key={k} className="flex items-center gap-8 pr-8 text-lg text-muted-foreground sm:text-xl">
        {k}
        <Feather className="h-4 w-4 text-primary/60" aria-hidden />
      </li>
    ))}
  </ul>
);

/**
 * The kinds of teams Workzen is made for, drifting slowly by. Pauses on hover;
 * with reduced motion it stops and wraps instead.
 */
export const Marquee = () => (
  <section aria-label="Made for" className="border-y border-border/70 bg-card py-6">
    <div className="mx-auto mb-3 max-w-[1180px] px-5 text-sm text-muted-foreground sm:px-8">
      Made for small teams of every kind
    </div>
    <div className="group relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
      <div className="flex w-max animate-[marquee_48s_linear_infinite] group-hover:[animation-play-state:paused] motion-reduce:w-auto motion-reduce:animate-none motion-reduce:flex-wrap motion-reduce:px-5">
        <Row />
        <span className="contents motion-reduce:hidden">
          <Row hidden />
        </span>
      </div>
    </div>
  </section>
);
