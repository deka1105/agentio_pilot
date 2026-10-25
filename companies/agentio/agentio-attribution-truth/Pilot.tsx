import { DemoBanner } from "@/lib/app-shell";
import { DEMO_NOTE } from "./model";
import { Harness } from "./Harness";

/**
 * Attribution truth harness — Agentio P-1.
 *
 * Client-side and stateless on purpose: it is a simulator, and there is no
 * state a second visitor should see. Every number on the page is computed in
 * the browser from the sliders by `model.ts`.
 */
export default function AttributionTruthPilot() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-6">
      <DemoBanner>{DEMO_NOTE}</DemoBanner>

      <h1 className="text-lg font-semibold tracking-tight">
        Your dashboard credits the creator campaign with a fraction of what it drove
      </h1>
      <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-foreground/65">
        Not because the campaign underperformed, but because of how the measurement works. These
        journeys are generated with a known cause for every conversion; the attribution models see
        only what a platform would see. The gap between them is measured rather than claimed.
      </p>

      <div className="mt-6">
        <Harness />
      </div>
    </div>
  );
}
