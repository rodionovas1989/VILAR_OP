import { ReactNode, useState } from 'react';
import IconButton from './IconButton';
import HintButton from './HintButton';
import { Modal } from './Modal';
import NumberTemplateBuilder, {
  NumberTemplate,
  describeNumberTemplate,
  emptyNumberTemplate,
  previewNumberTemplate,
} from './NumberTemplateBuilder';

type Props = {
  label?: string;
  value: NumberTemplate | null | undefined;
  onChange: (next: NumberTemplate) => void;
  hintTitle?: string;
  hint?: ReactNode;
};

export default function NumberTemplateField({
  label = 'Шаблон партии',
  value,
  onChange,
  hintTitle,
  hint,
}: Props) {
  const tpl = value || emptyNumberTemplate();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<NumberTemplate>(tpl);
  const tokens = Array.isArray(tpl.tokens) ? tpl.tokens : [];
  const summary = describeNumberTemplate(tpl);

  const openEditor = () => {
    setDraft({
      parseDirection: tpl.parseDirection === 'ltr' ? 'ltr' : 'rtl',
      tokens: [...tokens],
    });
    setOpen(true);
  };

  return (
    <div className="number-template-field">
      <div className="number-template-field-label">
        <span>{label}</span>
        {hint ? (
          <HintButton title={hintTitle || label} label={`Подсказка: ${label}`}>
            {hint}
          </HintButton>
        ) : null}
      </div>
      <div className="number-template-summary">
        <div className="number-template-summary-main">
          {tokens.length ? (
            <code className="number-template-result" title={summary}>
              {previewNumberTemplate(tpl)}
            </code>
          ) : (
            <span className="muted">без шаблона</span>
          )}
        </div>
        <IconButton icon="edit" label="Изменить шаблон" onClick={openEditor} />
      </div>
      <Modal
        nested
        wide
        open={open}
        title="Шаблон номера партии"
        onClose={() => setOpen(false)}
        footer={
          <div className="modal-footer-actions">
            <button type="button" className="ghost" onClick={() => setOpen(false)}>
              Отмена
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(draft);
                setOpen(false);
              }}
            >
              Готово
            </button>
          </div>
        }
      >
        <NumberTemplateBuilder value={draft} onChange={setDraft} />
      </Modal>
    </div>
  );
}
