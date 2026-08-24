/** Индикация одобрения контрагента и производителя по регистрации в спецификации */
export default function CounterpartyBadge({
  name,
  manufacturerName,
  approved,
}: {
  name: string;
  manufacturerName?: string | null;
  approved: boolean;
}) {
  const label =
    manufacturerName && manufacturerName !== '—' ? `${name} / ${manufacturerName}` : name;
  return (
    <span
      className={`cp-badge ${approved ? 'cp-approved' : 'cp-unapproved'}`}
      title={
        approved
          ? 'Контрагент и производитель одобрены для производства'
          : 'Контрагент и/или производитель не одобрены для производства'
      }
    >
      {label}
    </span>
  );
}
