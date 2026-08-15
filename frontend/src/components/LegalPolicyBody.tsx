import {
  buildPdnPolicySections,
  PDN_POLICY_VERSION,
  SYSTEM_DISCLAIMER,
} from '../content/legal';

type Props = {
  showDisclaimer?: boolean;
};

export default function LegalPolicyBody({ showDisclaimer = true }: Props) {
  const sections = buildPdnPolicySections();
  return (
    <div className="legal-policy-body">
      <p className="hint">
        Версия Политики: <strong>{PDN_POLICY_VERSION}</strong>
      </p>
      {showDisclaimer && <p className="legal-disclaimer">{SYSTEM_DISCLAIMER}</p>}
      {sections.map((s) => (
        <section key={s.title} className="legal-policy-section">
          <h3>{s.title}</h3>
          {s.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>
      ))}
    </div>
  );
}
