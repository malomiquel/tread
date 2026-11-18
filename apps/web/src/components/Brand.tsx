/** The name, as it stands at the top of every page; it leads to the landing page. */
export function Brand() {
  return (
    <a href={process.env.NEXT_PUBLIC_LANDING_URL ?? "http://localhost:3021"} className="brand" aria-label="Tread">
      Tread<span>.</span>
    </a>
  );
}
