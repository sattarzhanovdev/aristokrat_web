import React from "react";

/** Шлагбаум: стойка и полосатая стрела. Цвет берётся из currentColor, размер из font-size. */
export default function BarrierIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="1.35em" height="1.35em" fill="currentColor" aria-hidden="true" {...props}>
      {/* стойка и основание */}
      <rect x="2.8" y="9" width="4" height="12" rx="1" />
      <rect x="1.2" y="19.8" width="7.2" height="2.4" rx="1.2" />
      {/* стрела */}
      <rect
        x="6.4"
        y="6.6"
        width="16.2"
        height="4.8"
        rx="2.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      {/* полосы */}
      <path d="M9.4 6.6h3l-2.3 4.8h-3z" />
      <path d="M15 6.6h3l-2.3 4.8h-3z" />
      {/* шарнир */}
      <circle cx="4.8" cy="9" r="2.7" />
    </svg>
  );
}
