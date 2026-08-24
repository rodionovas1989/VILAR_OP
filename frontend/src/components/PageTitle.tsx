import FavoriteToggle from './FavoriteToggle';
import NavTypeIcon from './NavTypeIcon';

type Props = {
  pageId: string;
  title: string;
};

export default function PageTitle({ pageId, title }: Props) {
  return (
    <div className="page-title-row">
      <h1 className="page-title-heading">
        <NavTypeIcon pageId={pageId} className="page-title-type-icon" />
        <span>{title}</span>
      </h1>
      <FavoriteToggle pageId={pageId} />
    </div>
  );
}
