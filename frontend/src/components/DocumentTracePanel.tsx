import { Lot, Material, Warehouse } from '../types';
import { DocumentTrace, OrderTrace, TraceDocumentRef } from '../types.documents';
import { displayTimeFromIso, dateFromIso } from '../utils/docDateTime';

const DOC_STATUS: Record<string, string> = {
  draft: 'Создан',
  posted: 'Проведён',
  cancelled: 'Отменён',
  fulfilled: 'Выполнен',
};

const DOC_TYPE: Record<string, string> = {
  receipt: 'Приёмка',
  transfer: 'Перемещение',
  inventory: 'Инвентаризация',
  writeoff: 'Списание',
  posting: 'Оприходование',
  reservation: 'Резервирование',
  production_issue: 'Списание в производство',
  production_receipt: 'Выпуск из производства',
  shipment: 'Отгрузка',
  quality_management: 'Управление качеством',
};

const ORDER_STATUS: Record<string, string> = {
  новый: 'Новый',
  спланирован: 'Спланирован',
  завершен: 'Завершён',
  отменен: 'Отменён',
};

type Props = {
  trace: DocumentTrace | OrderTrace | null;
  loading?: boolean;
  materials: Material[];
  lots: Lot[];
  warehouses?: Warehouse[];
};

function isDocumentTrace(t: DocumentTrace | OrderTrace | null | undefined): t is DocumentTrace {
  return Boolean(t && typeof t === 'object' && 'document' in t && (t as DocumentTrace).document);
}

export default function DocumentTracePanel({
  trace,
  loading,
  materials,
  lots,
  warehouses = [],
}: Props) {
  const matName = (id?: string | null) =>
    (id && materials.find((m) => m.id === id)?.name) || id || '—';
  const lotNum = (id?: string | null) =>
    (id && lots.find((l) => l.id === id)?.number) || id || '—';
  const whName = (id?: string | null) =>
    (id && warehouses.find((w) => w.id === id)?.name) || id || '—';

  const docs: TraceDocumentRef[] = !trace
    ? []
    : isDocumentTrace(trace)
      ? trace.relatedDocuments || []
      : trace.documents || [];
  const movements = trace?.movements || [];
  const history = trace?.reservationHistory || [];
  const active = trace?.activeReservations || [];
  const stock = isDocumentTrace(trace) ? trace.stock || [] : [];
  const order = trace?.productionOrder || null;
  const qualityHistory = isDocumentTrace(trace) ? trace.qualityHistory || [] : [];
  const qualityRegister = isDocumentTrace(trace) ? trace.qualityRegister || [] : [];

  const empty =
    !loading &&
    !docs.length &&
    !movements.length &&
    !history.length &&
    !active.length &&
    !stock.length &&
    !order &&
    !qualityHistory.length &&
    !qualityRegister.length;

  return (
    <div className="trace-panel">
      {loading && <p className="hint">Загрузка связей…</p>}
      {!loading && !trace && <p className="hint">Нет данных трассировки</p>}
      {empty && <p className="hint">Пока нет движений и связанных документов</p>}

      {order && (
        <p className="trace-order">
          Заказ: {order.id ? `${order.id.slice(0, 8)}…` : '—'} · {ORDER_STATUS[order.status] || order.status} · выпуск{' '}
          {order.quantity} · {matName(order.materialId)}
        </p>
      )}

      {qualityHistory.length > 0 && (
        <div className="trace-block">
          <h4 className="trace-heading">Движения качества</h4>
          <div className="trace-table-wrap">
            <table className="data-table doc-lines-table">
              <thead>
                <tr>
                  <th>Когда</th>
                  <th>Действие</th>
                  <th>Материал</th>
                  <th>Партия</th>
                  <th>Качество</th>
                  <th>Разрешение</th>
                  <th>Статус док.</th>
                </tr>
              </thead>
              <tbody>
                {qualityHistory.map((h) => (
                  <tr key={h.id}>
                    <td>
                      {dateFromIso(h.at)} {displayTimeFromIso(h.at)}
                    </td>
                    <td>{h.action === 'post' ? 'проведение' : h.action === 'cancel' ? 'отмена' : h.action}</td>
                    <td>{matName(h.materialId)}</td>
                    <td>{lotNum(h.lotId)}</td>
                    <td>{h.qualityName || '—'}</td>
                    <td>{h.permissionLabel || h.permission || '—'}</td>
                    <td>{DOC_STATUS[h.documentStatus || ''] || h.documentStatus || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {qualityRegister.length > 0 && (
        <div className="trace-block">
          <h4 className="trace-heading">Текущее состояние партий (регистр)</h4>
          <div className="trace-table-wrap">
            <table className="data-table doc-lines-table">
              <thead>
                <tr>
                  <th>Партия</th>
                  <th>Материал</th>
                  <th>Качество</th>
                  <th>Разрешение</th>
                  <th>Документ</th>
                  <th>Обновлено</th>
                </tr>
              </thead>
              <tbody>
                {qualityRegister.map((r) => (
                  <tr key={r.id}>
                    <td>{lotNum(r.lotId)}</td>
                    <td>{matName(r.materialId)}</td>
                    <td>{r.qualityName || '—'}</td>
                    <td>{r.permissionLabel || r.permission || '—'}</td>
                    <td>{r.documentNumber || '—'}</td>
                    <td>
                      {r.updatedAt ? (
                        <>
                          {dateFromIso(r.updatedAt)} {displayTimeFromIso(r.updatedAt)}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {docs.length > 0 && (
        <div className="trace-block">
          <h4 className="trace-heading">Связанные документы</h4>
          <div className="trace-table-wrap">
            <table className="data-table doc-lines-table">
              <thead>
                <tr>
                  <th>Тип</th>
                  <th>Номер</th>
                  <th>Статус</th>
                  <th>Дата</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id}>
                    <td>{DOC_TYPE[d.type] || d.type}</td>
                    <td>{d.number}</td>
                    <td>{DOC_STATUS[d.status] || d.status}</td>
                    <td>{d.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {movements.length > 0 && (
        <div className="trace-block">
          <h4 className="trace-heading">Движения материалов</h4>
          <div className="trace-table-wrap">
            <table className="data-table doc-lines-table">
              <thead>
                <tr>
                  <th>Когда</th>
                  <th>Тип</th>
                  <th>Материал</th>
                  <th>Партия</th>
                  <th>Склад</th>
                  <th>Кол-во</th>
                  <th>Статус док.</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td>
                      {dateFromIso(m.at)} {displayTimeFromIso(m.at)}
                    </td>
                    <td>{m.type === 'issue' ? 'расход' : 'приход'}</td>
                    <td>{matName(m.materialId)}</td>
                    <td>{lotNum(m.lotId)}</td>
                    <td>{whName(m.warehouseId)}</td>
                    <td>{m.quantity}</td>
                    <td>{DOC_STATUS[m.documentStatus] || m.documentStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {active.length > 0 && (
        <div className="trace-block">
          <h4 className="trace-heading">Активный резерв</h4>
          <div className="trace-table-wrap">
            <table className="data-table doc-lines-table">
              <thead>
                <tr>
                  <th>Материал</th>
                  <th>Партия</th>
                  <th>Кол-во</th>
                </tr>
              </thead>
              <tbody>
                {active.map((r) => (
                  <tr key={r.id}>
                    <td>{matName(r.materialId)}</td>
                    <td>{lotNum(r.lotId)}</td>
                    <td>{r.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="trace-block">
          <h4 className="trace-heading">История резерва</h4>
          <div className="trace-table-wrap">
            <table className="data-table doc-lines-table">
              <thead>
                <tr>
                  <th>Когда</th>
                  <th>Действие</th>
                  <th>Документ</th>
                  <th>Материал</th>
                  <th>Кол-во</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td>
                      {dateFromIso(h.at)} {displayTimeFromIso(h.at)}
                    </td>
                    <td>{h.action}</td>
                    <td>{h.documentNumber}</td>
                    <td>{matName(h.materialId)}</td>
                    <td>{h.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {stock.length > 0 && (
        <div className="trace-block">
          <h4 className="trace-heading">Текущий запас по партиям строк</h4>
          <div className="trace-table-wrap">
            <table className="data-table doc-lines-table">
              <thead>
                <tr>
                  <th>Материал</th>
                  <th>Партия</th>
                  <th>Склад</th>
                  <th>Остаток</th>
                </tr>
              </thead>
              <tbody>
                {stock.map((s) => (
                  <tr key={s.id}>
                    <td>{matName(s.materialId)}</td>
                    <td>{lotNum(s.lotId)}</td>
                    <td>{whName(s.warehouseId)}</td>
                    <td>{s.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
