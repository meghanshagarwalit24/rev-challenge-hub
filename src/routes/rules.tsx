import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";

export const Route = createFileRoute("/rules")({
  component: RulesPage,
});

function RulesPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-4xl md:text-5xl font-black text-garnet">Rules</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>

        <div className="prose prose-sm md:prose-base mt-8 space-y-5 text-garnet/85">
          <section>
            <h2 className="text-xl font-bold text-garnet">1. Eligibility</h2>
            <p>The Revital Energy Challenge is open to UAE residents aged 18 and above. Participants must have a valid mobile number or email address. Employees of Revital and their immediate family members are not eligible.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-garnet">2. How to Play</h2>
            <p>Complete all three mini-games — Reflex Tap, Memory Match, and Balance — in sequence. Each game lasts up to 20 seconds. Your combined performance across all three games determines your final Energy Score out of 300.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-garnet">3. One Entry Per Day</h2>
            <p>Each verified participant may submit one score per day. Duplicate entries using the same contact details within a 24-hour period will be discarded and the earlier score will be retained.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-garnet">4. Score Verification</h2>
            <p>Scores are only eligible for prizes once verified via OTP. Unverified scores will not appear on the leaderboard and will not be considered for rewards.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-garnet">5. Fair Play</h2>
            <p>Any attempt to manipulate or artificially inflate scores — including the use of automation tools, bots, emulators, or multiple accounts — will result in immediate disqualification. Revital reserves the right to investigate suspicious activity and remove entries at its sole discretion.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-garnet">6. Leaderboard & Prizes</h2>
            <p>The daily leaderboard resets every 24 hours at midnight UAE time. The top-ranked participants on the daily leaderboard are eligible for the daily prize draw. The global leaderboard tracks all-time top scores. Prize winners will be contacted via their registered email or phone number within 5 business days.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-garnet">7. Prize Claim</h2>
            <p>Winners must claim their prize within 14 days of being contacted. Failure to respond within this period will result in forfeiture of the prize and selection of an alternate winner. Prizes are non-transferable and cannot be exchanged for cash.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-garnet">8. Modifications</h2>
            <p>Revital reserves the right to modify, suspend, or terminate the challenge at any time without prior notice. In such cases, no compensation will be owed to participants.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-garnet">9. Governing Law</h2>
            <p>These rules are governed by the laws of the United Arab Emirates. Any disputes arising from participation in the challenge shall be subject to the exclusive jurisdiction of the UAE courts.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-garnet">10. Contact</h2>
            <p>For questions about the rules, email <a className="text-[var(--tiger)] font-semibold" href="mailto:hello@revital.example">hello@revital.example</a>.</p>
          </section>
        </div>
      </main>
    </div>
  );
}
