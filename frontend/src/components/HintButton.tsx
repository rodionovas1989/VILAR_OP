import { ReactNode } from 'react';
import IconButton from './IconButton';
import { Modal, useModal } from './Modal';

type Props = {
  title: string;
  children: ReactNode;
  /** Подпись для aria/title кнопки */
  label?: string;
  /** Поверх уже открытой модалки справочника */
  nested?: boolean;
};

/** Пиктограмма «?» → всплывающая подсказка. Переиспользуется в формах. */
export default function HintButton({ title, children, label = 'Подсказка', nested = true }: Props) {
  const { open, openModal, closeModal } = useModal();

  return (
    <span className="hint-button-wrap">
      <IconButton
        icon="help"
        label={label}
        className="hint-button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          openModal();
        }}
      />
      <Modal
        nested={nested}
        open={open}
        title={title}
        onClose={closeModal}
        className="modal-hint"
        footer={
          <button type="button" onClick={closeModal}>
            Понятно
          </button>
        }
      >
        <div className="hint-button-body">{children}</div>
      </Modal>
    </span>
  );
}
