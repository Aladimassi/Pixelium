export function VoidBackground() {
  return (
    <>
      <div className="void-bg" aria-hidden="true">
        <div className="void-bg__grid" />
        <div className="void-bg__orb void-bg__orb--orange" />
        <div className="void-bg__orb void-bg__orb--gold" />
      </div>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
    </>
  );
}
