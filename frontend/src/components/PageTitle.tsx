import FavoriteToggle from './FavoriteToggle';

type Props = {
  pageId: string;
  title: string;
};

export default function PageTitle({ pageId, title }: Props) {
  return (
    <div className="page-title-row">
      <h1>{title}</h1>
      <FavoriteToggle pageId={pageId} />
    </div>
  );
}
