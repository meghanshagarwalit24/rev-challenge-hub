import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-4xl md:text-5xl font-black text-garnet">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>

        <div className="prose prose-sm md:prose-base mt-8 space-y-5 text-garnet/85">
          <section>
            <h2 className="text-xl font-bold text-garnet">1. Information We Collect</h2>
            <p>To participate in the Revital Energy Challenge we collect your name, mobile number or email, and game scores. Optional fields include city and address for prize delivery.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-garnet">2. How We Use It</h2>
            <p>Your data is used to verify your identity via OTP, save your scores, contact winners, and improve the campaign experience. We do not sell your data to third parties.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-garnet">3. Consent</h2>
            <p>By playing and submitting your score, you consent to be contacted via email or phone regarding the campaign and Revital products.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-garnet">4. Cookies</h2>
            <p>We use essential cookies for site functionality and analytics cookies (only after consent) to understand engagement.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-garnet">5. UAE Data Compliance</h2>
            <p>We follow the UAE Personal Data Protection Law (Federal Decree-Law No. 45 of 2021). You may request access, correction, or deletion of your data anytime.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-garnet">6. Contact</h2>
            <p>For privacy queries email <a className="text-[var(--tiger)] font-semibold" href="mailto:privacy@revital.example">privacy@revital.example</a>.</p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
