import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';

type DictOpt = { id: string; label: string };

export default function AdminExportDictionaries() {
  const [options, setOptions] = useState<DictOpt[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .adminDictionaries()
      .then((list) => {
        setOptions(list);
        setSelected(new Set(list.map((d) => d.id)));
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const allSelected = options.length > 0 && options.every((o) => selected.has(o.id));

  const selectedLabels = useMemo(
    () => options.filter((o) => selected.has(o.id)).map((o) => o.label),
    [options, selected]
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(options.map((o) => o.id)) : new Set());
  };

  const onExport = async () => {
    if (!selected.size) {
      setError('Выберите хотя бы один справочник');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api.exportDictionariesXlsx([...selected]);
      setMessage(`Экспортировано: ${selectedLabels.join(', ')}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page admin-export">
      <div className="page-toolbar">
        <h1>Экспорт справочников</h1>
        <div className="toolbar-actions">
          <button type="button" disabled={!selected.size || busy} onClick={onExport}>
            {busy ? 'Экспорт…' : `Экспортировать (${selected.size})`}
          </button>
        </div>
      </div>

      <p className="hint">
        Отметьте справочники для выгрузки. В Excel-файле каждый справочник попадёт на отдельный лист. Вложенные поля
        (например, строки спецификации) сохраняются как JSON в ячейке.
      </p>

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert info">{message}</div>}

      <div className="admin-export-panel">
        <label className="admin-export-all">
          <input
            type="checkbox"
            checked={allSelected}
            disabled={!options.length || busy}
            onChange={(e) => toggleAll(e.target.checked)}
          />
          <span>Выбрать все</span>
        </label>
        <ul className="admin-export-list">
          {options.map((o) => (
            <li key={o.id}>
              <label>
                <input
                  type="checkbox"
                  checked={selected.has(o.id)}
                  disabled={busy}
                  onChange={() => toggle(o.id)}
                />
                <span>{o.label}</span>
                <code className="muted">{o.id}</code>
              </label>
            </li>
          ))}
          {!options.length && !error && <li className="muted">Загрузка списка…</li>}
        </ul>
      </div>
    </div>
  );
}
