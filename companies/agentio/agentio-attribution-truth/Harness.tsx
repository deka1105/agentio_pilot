"use client";

import { useMemo, useState } from "react";
import { DEFAULTS, generate, analyse, lagSweep, type Params } from "./model";

const pct = (n: number) => `${(n * 100).toFixed(0)}%`;
const num = (n: number) => n.toLocaleString("en-US");

function Slider({
  label, value, min, max, step, suffix, onChange, hint,
}: {
  label: string; value: number; min: number; max: number; step: number;
  suffix?: string; hint?: string; onChange: (n: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] text-foreground/70">{label}</span>
        <span className="font-mono text-[11.5px] tabular-nums text-foreground/85">
          {value}{suffix}
        </span>
      </span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-foreground/70"
      />
      {hint && <span className="mt-0.5 block text-[11px] leading-snug text-foreground/45">{hint}</span>}
    </label>
  );
}

export function Harness() {
  const [p, setP] = useState<Params>(DEFAULTS);
  const set = (k: keyof Params) => (v: number) => setP((prev) => ({ ...prev, [k]: v }));

  const a = useMemo(() => analyse(generate(p), p.lookbackDays), [p]);
  const sweep = useMemo(() => lagSweep(p, [2, 5, 10, 20, 30, 45]), [p]);

  const worst = Math.max(a.trueCreator, ...a.models.map((m) => m.credited), 1);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-foreground/12 px-4 py-3">
        <div className="text-[12px] text-foreground/55">Of {num(a.conversions)} conversions in this window</div>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-mono text-[30px] leading-none tabular-nums">{num(a.trueCreator)}</span>
          <span className="text-[13px] text-foreground/70">
            would not have happened without the creator placement
          </span>
        </div>
        <div className="mt-2 text-[12px] leading-relaxed text-foreground/55">
          Set when each journey was generated, so it is known exactly. Every model below sees only
          the touches — never this number. {pct(a.unclickedShare)} of creator placements were watched
          without a click, and {pct(a.outsideWindowShare)} happened before the {p.lookbackDays}-day
          window even opened. Median gap between watching and buying: {a.medianLag} days.
        </div>
      </div>

      <section>
        <h2 className="mb-2 text-[13px] font-semibold">What each method reports</h2>
        <div className="space-y-2">
          {a.models.map((m) => {
            const under = m.ratio !== null && m.ratio > 1.15;
            const over = m.errorPct !== null && m.errorPct > 15;
            return (
              <div key={m.key} className="rounded-lg border border-foreground/12 px-3.5 py-2.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="text-[13px] font-medium">{m.label}</span>
                  <span className="font-mono text-[12px] tabular-nums">
                    <span className={under ? "text-red-700 dark:text-red-400" : over ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-400"}>
                      {num(m.credited)}
                    </span>
                    <span className="text-foreground/45"> of {num(a.trueCreator)}</span>
                    {m.ratio !== null && m.ratio > 1.05 && (
                      <span className="ml-2 text-foreground/70">understates {m.ratio.toFixed(1)}×</span>
                    )}
                    {m.errorPct !== null && m.errorPct > 5 && (
                      <span className="ml-2 text-foreground/70">overstates {(m.errorPct).toFixed(0)}%</span>
                    )}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
                  <div
                    className={`h-full rounded-full ${under ? "bg-red-500/70" : over ? "bg-amber-500/70" : "bg-emerald-500/70"}`}
                    style={{ width: `${Math.min(100, (m.credited / worst) * 100)}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-foreground/55">{m.note}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-foreground/12 px-4 py-3">
        <h2 className="text-[13px] font-semibold">Move the inputs</h2>
        <p className="mt-1 text-[11.5px] leading-relaxed text-foreground/55">
          Everything above recomputes. The point is not any single number — it is which inputs
          change the gap and which do not.
        </p>
        <div className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Slider label="Creator reach" value={Math.round(p.creatorReach * 100)} min={5} max={90} step={5} suffix="%"
            onChange={(v) => set("creatorReach")(v / 100)} hint="Share of the audience that sees the placement" />
          <Slider label="True incremental lift" value={Number((p.creatorUplift * 100).toFixed(1))} min={0} max={6} step={0.2} suffix="pp"
            onChange={(v) => set("creatorUplift")(v / 100)} hint="Extra conversion rate the placement actually causes" />
          <Slider label="Consideration window" value={p.considerationDays} min={1} max={45} step={1} suffix=" days"
            onChange={set("considerationDays")} hint="Median gap between watching and buying" />
          <Slider label="Attribution lookback" value={p.lookbackDays} min={1} max={45} step={1} suffix=" days"
            onChange={set("lookbackDays")} hint="The platform's window. Touches older than this do not exist to it" />
          <Slider label="Creator click-through" value={Math.round(p.creatorClickRate * 100)} min={0} max={40} step={1} suffix="%"
            onChange={(v) => set("creatorClickRate")(v / 100)} hint="Share who click rather than only watch" />
          <Slider label="Survey recall" value={Math.round(p.surveyRecall * 100)} min={10} max={95} step={5} suffix="%"
            onChange={(v) => set("surveyRecall")(v / 100)} hint="Correct recall at zero lag, decaying with time" />
        </div>
        <button
          type="button"
          onClick={() => setP({ ...DEFAULTS, seed: Math.floor(Math.random() * 10000) })}
          className="mt-3 rounded border border-foreground/20 px-2.5 py-1 text-[12px] transition-colors hover:border-foreground/40 hover:bg-foreground/5"
        >
          Reset with a new random audience
        </button>
      </section>

      <section>
        <h2 className="mb-2 text-[13px] font-semibold">
          Why the gap grows{" "}
          <span className="font-mono text-[11px] font-normal text-foreground/50">
            consideration window vs a fixed {p.lookbackDays}-day lookback
          </span>
        </h2>
        <div className="overflow-hidden rounded-lg border border-foreground/12">
          <table className="w-full text-[12px]">
            <thead className="bg-foreground/[0.04] text-[11px] text-foreground/60">
              <tr>
                <th className="px-3 py-1.5 text-left font-medium">Median gap</th>
                <th className="px-3 py-1.5 text-right font-medium">Truth</th>
                <th className="px-3 py-1.5 text-right font-medium">Last click</th>
                <th className="px-3 py-1.5 text-right font-medium">Survey</th>
                <th className="px-3 py-1.5 text-right font-medium">Incrementality</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/10 font-mono tabular-nums">
              {sweep.map((r) => (
                <tr key={r.day}>
                  <td className="px-3 py-1.5 text-foreground/70">{r.day} days</td>
                  <td className="px-3 py-1.5 text-right">{num(r.truth)}</td>
                  <td className="px-3 py-1.5 text-right text-red-700 dark:text-red-400">{num(r.lastClick)}</td>
                  <td className="px-3 py-1.5 text-right text-amber-700 dark:text-amber-300">{num(r.survey)}</td>
                  <td className="px-3 py-1.5 text-right text-emerald-700 dark:text-emerald-400">{num(r.incrementality)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11.5px] leading-relaxed text-foreground/55">
          Last click barely moves, because the problem is not the length of the window — it is that
          a watched placement is not a click. Survey answers decay as the gap widens and memory
          fades. Only the method with a control group tracks the truth across the range.
        </p>
      </section>
    </div>
  );
}
