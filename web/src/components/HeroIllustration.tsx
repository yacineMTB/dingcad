"use client";

import { useEffect, useState } from "react";

export default function HeroIllustration() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="hero-illustration"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <svg
        viewBox="0 0 400 320"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="hero-blueprint-svg"
      >
        {/* House body */}
        <rect
          x="80" y="140" width="240" height="140"
          className="bp-line bp-delay-1"
        />
        {/* Roof */}
        <polyline
          points="60,140 200,40 340,140"
          className="bp-line bp-delay-2"
        />
        {/* Roof ridge line */}
        <line
          x1="200" y1="40" x2="200" y2="20"
          className="bp-line bp-delay-2"
        />
        {/* Chimney */}
        <rect
          x="260" y="55" width="30" height="55"
          className="bp-line bp-delay-3"
        />
        {/* Door */}
        <rect
          x="170" y="210" width="60" height="70"
          className="bp-line bp-delay-4"
        />
        {/* Door handle */}
        <circle
          cx="220" cy="248" r="3"
          className="bp-dot bp-delay-5"
        />
        {/* Left window */}
        <rect
          x="100" y="175" width="45" height="40"
          className="bp-line bp-delay-4"
        />
        {/* Left window cross */}
        <line
          x1="122.5" y1="175" x2="122.5" y2="215"
          className="bp-line bp-delay-5"
        />
        <line
          x1="100" y1="195" x2="145" y2="195"
          className="bp-line bp-delay-5"
        />
        {/* Right window */}
        <rect
          x="255" y="175" width="45" height="40"
          className="bp-line bp-delay-4"
        />
        {/* Right window cross */}
        <line
          x1="277.5" y1="175" x2="277.5" y2="215"
          className="bp-line bp-delay-5"
        />
        <line
          x1="255" y1="195" x2="300" y2="195"
          className="bp-line bp-delay-5"
        />
        {/* Attic window (circular) */}
        <circle
          cx="200" cy="110" r="18"
          className="bp-line bp-delay-3"
        />
        {/* Attic window cross */}
        <line
          x1="200" y1="92" x2="200" y2="128"
          className="bp-line bp-delay-5"
        />
        <line
          x1="182" y1="110" x2="218" y2="110"
          className="bp-line bp-delay-5"
        />
        {/* Ground line */}
        <line
          x1="40" y1="280" x2="360" y2="280"
          className="bp-line bp-delay-1"
        />
        {/* Dimension lines */}
        <line
          x1="80" y1="295" x2="320" y2="295"
          className="bp-dim bp-delay-6"
        />
        <line
          x1="80" y1="290" x2="80" y2="300"
          className="bp-dim bp-delay-6"
        />
        <line
          x1="320" y1="290" x2="320" y2="300"
          className="bp-dim bp-delay-6"
        />
        <text
          x="200" y="310"
          className="bp-text bp-delay-6"
          textAnchor="middle"
        >
          12 000
        </text>
        {/* Height dimension */}
        <line
          x1="350" y1="140" x2="350" y2="280"
          className="bp-dim bp-delay-6"
        />
        <line
          x1="345" y1="140" x2="355" y2="140"
          className="bp-dim bp-delay-6"
        />
        <line
          x1="345" y1="280" x2="355" y2="280"
          className="bp-dim bp-delay-6"
        />
        <text
          x="365" y="215"
          className="bp-text bp-delay-6"
          textAnchor="middle"
          transform="rotate(-90 365 215)"
        >
          7 000
        </text>
        {/* Steps */}
        <line
          x1="165" y1="280" x2="165" y2="275"
          className="bp-line bp-delay-5"
        />
        <line
          x1="165" y1="275" x2="235" y2="275"
          className="bp-line bp-delay-5"
        />
        <line
          x1="235" y1="275" x2="235" y2="280"
          className="bp-line bp-delay-5"
        />
      </svg>
    </div>
  );
}
