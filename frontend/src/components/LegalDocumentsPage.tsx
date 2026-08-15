import PageTitle from './PageTitle';
import LegalPolicyBody from './LegalPolicyBody';
import { SYSTEM_DISCLAIMER } from '../content/legal';

export default function LegalDocumentsPage() {
  return (
    <div className="page legal-documents-page">
      <PageTitle pageId="admin_legal" title="Политика ПДн и правовая информация" />
      <p className="hint legal-disclaimer">{SYSTEM_DISCLAIMER}</p>
      <LegalPolicyBody showDisclaimer={false} />
    </div>
  );
}
