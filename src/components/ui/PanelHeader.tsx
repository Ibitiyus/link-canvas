export function PanelHeader({
  index,
  title,
  subtitle,
}: {
  index: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="panel-header">
      <span className="panel-index">{index}</span>
      <div>
        <span>{title}</span>
        <small>{subtitle}</small>
      </div>
      <span className="panel-cross" aria-hidden="true">
        +
      </span>
    </div>
  );
}
