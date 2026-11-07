import Link from "next/link";
import { Gift } from "lucide-react";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Footer, Header } from "@/components/noel/bits";
import styles from "@/components/noel/noel.module.css";

export default function NotFound() {
  return (
    <>
      <Header />
      <main className={`page ${styles.listPage}`}>
        <EmptyState
          icon={<Gift aria-hidden="true" />}
          title="Cette liste n'existe pas"
          description="Le lien est peut-être incomplet. Demande-le à nouveau à la personne qui te l'a envoyé."
          action={<Link href="/">Créer ma liste</Link>}
        />
      </main>
      <Footer />
    </>
  );
}
