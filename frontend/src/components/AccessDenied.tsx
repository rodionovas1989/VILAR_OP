type Props = { title?: string };

export default function AccessDenied({ title = 'Нет доступа' }: Props) {
  return (
    <div className="page access-denied">
      <h1>{title}</h1>
      <p className="hint">У вашей роли нет прав на этот раздел. Обратитесь к администратору.</p>
    </div>
  );
}
