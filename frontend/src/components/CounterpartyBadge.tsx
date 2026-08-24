/** Индикация одобрения контрагента или производителя по регистрации в спецификации */
export default function CounterpartyBadge({
  name,
  approved,
  kind = 'counterparty',
}: {
  name: string;
  approved: boolean;
  kind?: 'counterparty' | 'manufacturer';
}) {
  const titles =
    kind === 'manufacturer'
      ? {
          yes: 'Производитель одобрен для производства',
          no: 'Производитель не одобрен для производства',
        }
      : {
          yes: 'Контрагент одобрен для производства',
          no: 'Контрагент не одобрен для производства',
        };
  return (
    <span
      className={`cp-badge ${approved ? 'cp-approved' : 'cp-unapproved'}`}
      title={approved ? titles.yes : titles.no}
    >
      {name}
    </span>
  );
}
