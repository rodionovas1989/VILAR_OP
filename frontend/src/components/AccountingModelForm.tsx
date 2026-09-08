import { NumberTemplate, emptyNumberTemplate } from './NumberTemplateBuilder';
import LabeledToggle from './LabeledToggle';
import NumberTemplateField from './NumberTemplateField';
import SearchableSelect from './SearchableSelect';
import HintButton from './HintButton';

type Props = {
  editing: Record<string, unknown>;
  setEditing: (row: Record<string, unknown>) => void;
};

export default function AccountingModelForm({ editing, setEditing }: Props) {
  const template = (editing.lotNumberTemplate as NumberTemplate) || emptyNumberTemplate();
  const setField = (key: string, value: unknown) => setEditing({ ...editing, [key]: value });

  return (
    <div className="accounting-model-form">
      <LabeledToggle
        checked={Boolean(editing.ownProduction)}
        onCheckedChange={(on) => setField('ownProduction', on)}
        label="Собственное производство"
        hint={
          <p>
            Включайте для материалов, которые выпускает предприятие. Номер партии и серии тогда задаётся
            шаблоном (загрузка, месяц, год). Для закупаемого сырья оставьте выключенным — номер свободный.
          </p>
        }
      />
      <LabeledToggle
        checked={Boolean(editing.generateOnRelease)}
        onCheckedChange={(on) => setField('generateOnRelease', on)}
        label="Генерировать номер при выпуске"
        hint={
          <p>
            Система сможет подставлять номер по шаблону при планировании серий и выпуске из производства.
            Если шаблон пуст, генерация не сработает.
          </p>
        }
      />
      <div className="full-width accounting-model-parse">
        <div className="number-template-field-label">
          <span>Разбор номера при записи партии</span>
          <HintButton title="Разбор номера при записи партии">
            <p>Что делать с номером, когда партию сохраняют:</p>
            <ul>
              <li>
                <strong>Не разбирать</strong> — порядок выпуска не трогаем (обычный закуп).
              </li>
              <li>
                <strong>Заполнить, если совпал</strong> — если номер подходит под шаблон, записываем номер
                загрузки; иначе оставляем пустым.
              </li>
              <li>
                <strong>Запретить, если не совпал</strong> — нельзя сохранить партию с номером вне шаблона.
              </li>
            </ul>
          </HintButton>
        </div>
        <SearchableSelect
          value={String(editing.parseMode || 'none')}
          allowEmpty={false}
          onChange={(v) => setField('parseMode', v)}
          options={[
            { value: 'none', label: 'Не разбирать' },
            { value: 'fill', label: 'Заполнить порядок, если номер совпал' },
            { value: 'strict', label: 'Запретить запись, если номер не совпал' },
          ]}
        />
      </div>
      <NumberTemplateField
        value={template}
        onChange={(next) => setField('lotNumberTemplate', next)}
        hint={
          <>
            <p>
              Итог на карточке — как будет выглядеть номер: блоки слева направо. Порядок блоков и направление
              разбора меняются в окне редактирования.
            </p>
            <p>
              Разбор <strong>справа налево</strong> сначала снимает фиксированный хвост (месяц и год), слева
              остаётся номер загрузки любой длины — поэтому 90-я и 100-я загрузки не путаются.
            </p>
          </>
        }
      />
    </div>
  );
}
