/** Индикация одобрения поставщика по регистрации в спецификации */
export default function CounterpartyBadge({
  name,
  approved,
}: {
  name: string;
  approved: boolean;
}) {
  return (
    <span
      className={`cp-badge ${approved ? 'cp-approved' : 'cp-unapproved'}`}
      title={approved ? 'Поставщик одобрен для производства' : 'Поставщик не одобрен для производства'}
    >
      {name}
    </span>
  );
}
