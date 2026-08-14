import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api';
import { canViewObject } from '../auth/permissions';
import { useAuth } from '../auth/AuthContext';
import AccessDenied from './AccessDenied';
import IconButton from './IconButton';
import PageTitle from './PageTitle';
import { Modal } from './Modal';
import PermissionMatrix from './PermissionMatrix';
import RefreshButton from './RefreshButton';
import { Role, emptyPermissions, normalizePermissions } from '../constants/systemObjects';
import { newId } from '../utils/id';

function emptyRole(): Role {
  return {
    id: '',
    name: '',
    code: '',
    permissions: emptyPermissions(),
  };
}

export default function RolesPage() {
  const { user } = useAuth();
  const loggedIn = Boolean(user);
  const [rows, setRows] = useState<Role[]>([]);
  const [editing, setEditing] = useState<Role | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setError('');
    try {
      setRows(await api.list<Role>('roles'));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const openCreate = () => setEditing(emptyRole());

  const openEdit = (role: Role) => {
    setEditing({
      ...role,
      permissions: normalizePermissions(role.permissions || {}),
    });
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError('');
    try {
      const body = {
        name: editing.name.trim(),
        code: editing.code.trim(),
        permissions: editing.permissions,
      };
      if (!body.name || !body.code) throw new Error('Укажите название и код роли');
      if (editing.id) {
        await api.update('roles', editing.id, body);
      } else {
        await api.create('roles', { ...body, id: `role-${newId()}` });
      }
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (!canViewObject(user?.permissions, 'admin_roles', loggedIn)) {
    return <AccessDenied title="Роли" />;
  }

  return (
    <div className="page">
      <PageTitle pageId="roles" title="Роли" />
      <p className="hint">
        Матрица прав по объектам системы: справочники (без движений), складские документы, заказы на
        производство.
      </p>

      <div className="toolbar" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" onClick={openCreate} disabled={busy}>
          Создать
        </button>
        <RefreshButton onClick={() => load()} disabled={busy} />
      </div>

      {error && <p className="error">{error}</p>}

      <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Название</th>
            <th>Код</th>
            <th>Объектов с доступом</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((role) => {
            const count = Object.values(role.permissions || {}).filter((p) => p.read).length;
            return (
              <tr key={role.id}>
                <td>{role.name}</td>
                <td>
                  <code>{role.code}</code>
                </td>
                <td>{count}</td>
                <td>
                  <IconButton icon="edit" label="Изменить" onClick={() => openEdit(role)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>

      {editing && (
        <Modal
          open
          wide
          className="modal-role"
          title={editing.id ? `Роль — ${editing.name}` : 'Новая роль'}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button type="button" className="ghost" onClick={() => setEditing(null)}>
                Отмена
              </button>
              <button type="submit" form="role-form" disabled={busy}>
                Сохранить
              </button>
            </>
          }
        >
          <form id="role-form" onSubmit={save} className="role-form">
            <div className="form-grid role-form-head">
              <label>
                Название
                <input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  required
                />
              </label>
              <label>
                Код
                <input
                  value={editing.code}
                  onChange={(e) => setEditing({ ...editing, code: e.target.value })}
                  required
                  placeholder="storekeeper"
                />
              </label>
            </div>
            <PermissionMatrix
              value={editing.permissions}
              onChange={(permissions) => setEditing({ ...editing, permissions })}
            />
          </form>
        </Modal>
      )}
    </div>
  );
}
