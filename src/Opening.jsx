import React from "react";
export default function Opening({ label = "Opening RentKeep" }) {
  return (
    <div className="opening" role="status" aria-live="polite">
      <div className="opening-inner">
        <svg aria-hidden="true" className="opening-mark" viewBox="0 0 80 80">
          <rect x="1" y="1" width="78" height="78" rx="22" fill="#285d46" />
          <g
            fill="none"
            stroke="#dcead3"
            strokeWidth="2.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path className="roof-line" d="M15 37 40 18l25 19M22 36v26h36V36" />
            <path d="M35 62V44h10v18" />
          </g>
        </svg>
        <p className="opening-org">P&O ENTERPRISE</p>
        <h1>
          RentKeep<span>.</span>
        </h1>
        <div className="opening-track" />
        <p className="opening-label">{label}</p>
      </div>
    </div>
  );
}
