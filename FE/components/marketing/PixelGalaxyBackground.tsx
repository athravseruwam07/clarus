export default function PixelGalaxyBackground() {
  return (
    <div className="landing-galaxy pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="landing-galaxy__base absolute inset-0" />
      <div className="landing-galaxy__stars landing-galaxy__stars--tiny absolute inset-0" />
      <div className="landing-galaxy__stars landing-galaxy__stars--small absolute inset-0" />
      <div className="landing-galaxy__stars landing-galaxy__stars--medium absolute inset-0" />
      <div className="landing-galaxy__vignette absolute inset-0" />
    </div>
  );
}
