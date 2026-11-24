// A small gauge showing where a length falls against the recommended range.
export default function Meter({ len, lo, hi, max }) {
  const pct = (n) => `${Math.min(100, (n / max) * 100)}%`;
  const ok = len >= lo && len <= hi;
  return (
    <span className="meter" aria-hidden="true">
      <span className="meter-zone" style={{ left: pct(lo), width: `calc(${pct(hi)} - ${pct(lo)})` }} />
      <span className={`meter-dot ${len === 0 ? "none" : ok ? "good" : "warn"}`} style={{ left: pct(len) }} />
    </span>
  );
}
