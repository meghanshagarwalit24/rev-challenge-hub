import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-4xl md:text-5xl font-black text-garnet">Terms & Conditions</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>

        <div className="prose prose-sm md:prose-base mt-8 space-y-5 text-garnet/85">
          <section>
            <h2 className="text-xl font-bold text-garnet">1. Eligibility</h2>
            <p>The Revital Energy Challenge is open to UAE residents aged 18 and above. One entry per person per day.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-garnet">2. How to Participate</h2>
            <p>Complete all 3 challenges in sequence, submit your score, and verify your contact via OTP to be eligible for the leaderboard and rewards.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-garnet">3. Rewards</h2>
            <p>Daily and global leaderboard rewards are awarded at the sole discretion of Revital. Winners will be contacted via the registered email or phone number.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-garnet">4. Fair Play</h2>
            <p>Any attempt to manipulate scores, use bots, or create multiple accounts will result in disqualification.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-garnet">5. Liability</h2>
            <p>Revital is not liable for technical interruptions, lost entries, or issues beyond our reasonable control.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-garnet">6. Governing Law</h2>
            <p>These terms are governed by the laws of the United Arab Emirates.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-garnet">7. Contact</h2>
            <p>Questions? Email <a className="text-[var(--tiger)] font-semibold" href="mailto:hello@revital.example">hello@revital.example</a>.</p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
