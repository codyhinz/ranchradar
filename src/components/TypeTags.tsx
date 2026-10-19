/** Type names shown as text with a colored dot, so meaning never depends on color alone. */
export function TypeTags({ types }: { types: string[] }) {
  return (
    <span className="types">
      {types.map((type) => (
        <span key={type} className="type" data-type={type}>{type}</span>
      ))}
    </span>
  );
}
