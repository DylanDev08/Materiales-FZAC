export const EmptyState = ({
  title = 'No hay resultados',
  text = 'No encontramos información para mostrar.',
  action
}) => (
  <div className="empty-state">
    <h2>{title}</h2>
    <p>{text}</p>
    {action}
  </div>
);
