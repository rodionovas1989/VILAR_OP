import { Fragment } from 'react';
import { PermissionMap, SYSTEM_OBJECT_GROUPS, normalizePermissions } from '../constants/systemObjects';

type Props = {
  value: PermissionMap;
  onChange: (next: PermissionMap) => void;
  disabled?: boolean;
};

export default function PermissionMatrix({ value, onChange, disabled }: Props) {
  const setFlag = (objectId: string, key: 'read' | 'create' | 'modify', checked: boolean) => {
    const next = normalizePermissions({ ...value });
    const cell = { ...next[objectId] };
    if (key === 'read') {
      cell.read = checked;
      if (!checked) {
        cell.create = false;
        cell.modify = false;
      }
    }
    if (key === 'create') {
      cell.create = checked;
      if (checked) cell.read = true;
      if (!checked) cell.modify = false;
    }
    if (key === 'modify') {
      cell.modify = checked;
      if (checked) {
        cell.read = true;
        cell.create = true;
      }
    }
    next[objectId] = cell;
    onChange(next);
  };

  return (
    <div className="perm-matrix-wrap">
      <table className="perm-matrix">
        <thead>
          <tr>
            <th>Объект системы</th>
            <th>Чтение</th>
            <th>Создание</th>
            <th>Изменение</th>
          </tr>
        </thead>
        <tbody>
          {SYSTEM_OBJECT_GROUPS.map((group) => (
            <Fragment key={group.id}>
              <tr className="perm-matrix-group">
                <td colSpan={4}>{group.label}</td>
              </tr>
              {group.objects.map((obj) => {
                const p = value[obj.id] || { read: false, create: false, modify: false };
                return (
                  <tr key={obj.id}>
                    <td>{obj.label}</td>
                    <td className="perm-matrix-check">
                      <input
                        type="checkbox"
                        checked={p.read}
                        disabled={disabled}
                        onChange={(e) => setFlag(obj.id, 'read', e.target.checked)}
                      />
                    </td>
                    <td className="perm-matrix-check">
                      <input
                        type="checkbox"
                        checked={p.create}
                        disabled={disabled || !p.read}
                        onChange={(e) => setFlag(obj.id, 'create', e.target.checked)}
                      />
                    </td>
                    <td className="perm-matrix-check">
                      <input
                        type="checkbox"
                        checked={p.modify}
                        disabled={disabled || !p.create}
                        onChange={(e) => setFlag(obj.id, 'modify', e.target.checked)}
                      />
                    </td>
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
