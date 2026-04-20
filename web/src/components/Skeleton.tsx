"use client";

export function SkeletonBlock({
  width,
  height,
  radius,
  style,
}: {
  width?: string | number;
  height?: string | number;
  radius?: string | number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="skeleton"
      style={{
        width: width ?? "100%",
        height: height ?? 16,
        borderRadius: radius ?? "var(--radius-sm)",
        ...style,
      }}
    />
  );
}

/** Skeleton for a project card in the project list. */
export function SkeletonProjectCard({ delay = 0 }: { delay?: number }) {
  return (
    <div
      className="card"
      style={{
        padding: "22px 28px",
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 16,
        alignItems: "center",
        animation: `fadeIn 0.3s ease ${delay}s both`,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <SkeletonBlock width={180} height={20} />
          <SkeletonBlock width={60} height={22} radius={100} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <SkeletonBlock width={120} height={14} />
          <SkeletonBlock width={70} height={14} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <SkeletonBlock width={52} height={30} />
        <SkeletonBlock width={52} height={30} />
        <SkeletonBlock width={52} height={30} />
      </div>
    </div>
  );
}

/** Skeleton for a table row (e.g. admin panel). */
export function SkeletonTableRow({ columns = 5, delay = 0 }: { columns?: number; delay?: number }) {
  return (
    <tr style={{ animation: `fadeIn 0.3s ease ${delay}s both` }}>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          <SkeletonBlock
            width={i === 0 ? 36 : `${60 + Math.random() * 40}%`}
            height={i === 0 ? 36 : 14}
            radius={i === 0 ? 6 : undefined}
          />
        </td>
      ))}
    </tr>
  );
}

/** Full-page loading skeleton for the project editor. */
export function SkeletonProjectEditor() {
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Header skeleton */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 16px",
          background: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <SkeletonBlock width={32} height={32} />
        <div style={{ width: 1, height: 20, background: "var(--border)" }} />
        <SkeletonBlock width={200} height={20} />
        <div style={{ flex: 1 }} />
        <SkeletonBlock width={80} height={32} />
        <SkeletonBlock width={72} height={32} />
      </div>
      {/* Body skeleton */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <SkeletonBlock width={100} height={14} />
          <SkeletonBlock height="100%" radius="var(--radius-md)" />
        </div>
        <div style={{ width: 360, borderLeft: "1px solid var(--border)", padding: 16 }}>
          <SkeletonBlock width={140} height={18} style={{ marginBottom: 16 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[0, 1, 2].map((i) => (
              <SkeletonBlock key={i} height={70} radius="var(--radius-sm)" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
