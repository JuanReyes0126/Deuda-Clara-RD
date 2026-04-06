import type { Metadata } from "next";

import { LegalDocumentPage } from "@/components/legal/legal-document-page";
import { LEGAL_DOCUMENTS } from "@/config/legal";

const document = LEGAL_DOCUMENTS.privacy;

export const metadata: Metadata = {
  title: `${document.title} | Deuda Clara RD`,
  description: document.description,
};

export default function PrivacyPage() {
  return <LegalDocumentPage document={document} />;
}
