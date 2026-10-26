export function PanelHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="panel-header">
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
