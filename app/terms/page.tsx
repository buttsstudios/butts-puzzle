import type { Metadata } from "next";
import LegalPage from "@/lib/LegalPage";

const URL_ = "https://buttsstudios.com/games/sliding-numbers/terms";
const TITLE = "Terms of Use · Sliding Numbers · Butts Studios";
const DESC = "The terms for using Sliding Numbers, the browser game from Butts Studios, including how the one-time unlock purchase works.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: URL_ },
  openGraph: { type: "website", url: URL_, title: TITLE, description: DESC, siteName: "Butts Studios", locale: "en_US" },
};

export default function Page() {
  return <LegalPage kind="terms" title="Terms of Use" game="Sliding Numbers" gameUrl="https://buttsstudios.com/games/sliding-numbers" />;
}
