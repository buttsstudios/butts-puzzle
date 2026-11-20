import type { Metadata } from "next";
import LegalPage from "@/lib/LegalPage";

const URL_ = "https://buttsstudios.com/games/sliding-numbers/refunds";
const TITLE = "Refund Policy · Sliding Numbers · Butts Studios";
const DESC = "Sliding Numbers refund policy: 14-day refunds on the one-time unlock, restores after lost browser data, and how to ask.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: URL_ },
  openGraph: { type: "website", url: URL_, title: TITLE, description: DESC, siteName: "Butts Studios", locale: "en_US" },
};

export default function Page() {
  return <LegalPage kind="refunds" title="Refund Policy" game="Sliding Numbers" gameUrl="https://buttsstudios.com/games/sliding-numbers" />;
}
