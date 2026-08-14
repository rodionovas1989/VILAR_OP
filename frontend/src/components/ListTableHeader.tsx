import { ReactNode } from 'react';
import { ListColumn } from '../hooks/useListTable';

type Props<T> = {
  columns: ListColumn<T>[];
  extraHead?: ReactNode;
};

export default function ListTableHeader<T>({ columns, extraHead }: Props<T>) {
  return (
    <thead>
      <tr>
        {columns.map((col) => (
          <th key={col.key}>{col.label}</th>
        ))}
        {extraHead}
      </tr>
    </thead>
  );
}
