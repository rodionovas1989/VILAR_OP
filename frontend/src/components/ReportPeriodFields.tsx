import { useEffect, useState } from 'react';

type Props = {
  from: string;
  to: string;
  disabled?: boolean;
  onCommit: (from: string, to: string) => void;
};

/** Даты периода: запрос уходит, когда поле теряет фокус или нажат Enter. */
export default function ReportPeriodFields({ from, to, disabled, onCommit }: Props) {
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);

  useEffect(() => {
    setDraftFrom(from);
    setDraftTo(to);
  }, [from, to]);

  const commit = (nextFrom: string, nextTo: string) => {
    if (nextFrom === from && nextTo === to) return;
    onCommit(nextFrom, nextTo);
  };

  return (
    <>
      <label className="report-filter-inline">
        <span>с</span>
        <input
          type="date"
          value={draftFrom}
          disabled={disabled}
          onChange={(e) => setDraftFrom(e.target.value)}
          onBlur={(e) => commit(e.currentTarget.value, draftTo)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
      </label>
      <label className="report-filter-inline">
        <span>по</span>
        <input
          type="date"
          value={draftTo}
          disabled={disabled}
          onChange={(e) => setDraftTo(e.target.value)}
          onBlur={(e) => commit(draftFrom, e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
      </label>
    </>
  );
}
