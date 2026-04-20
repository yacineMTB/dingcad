"use client";

import { useTranslation } from "@/components/LocaleProvider";
import ScrollReveal from "@/components/ScrollReveal";

export default function LandingFooter() {
  const { locale } = useTranslation();
  const year = new Date().getFullYear();

  const dataSources = [
    { name: "DVV", desc: locale === "fi" ? "Vaestorekisterikeskus" : "Population Register Centre" },
    { name: "MML", desc: locale === "fi" ? "Maanmittauslaitos" : "National Land Survey" },
    { name: "K-Rauta", desc: locale === "fi" ? "Rakennustarvikkeet" : "Building materials" },
    { name: "Stark", desc: locale === "fi" ? "Rakennustarvikkeet" : "Building materials" },
    { name: "Sarokas", desc: locale === "fi" ? "Puutavara" : "Timber products" },
    { name: "Ruukki", desc: locale === "fi" ? "Kattomateriaalit" : "Roofing materials" },
  ];

  return (
    <footer className="landing-footer">
      <ScrollReveal>
      <div className="landing-footer-inner">
        <div className="landing-footer-brand">
          <div className="heading-display" style={{ fontSize: 20, marginBottom: 8 }}>
            <span>Hel</span><span style={{ color: "var(--amber)" }}>scoop</span>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, maxWidth: 280 }}>
            {locale === "fi"
              ? "Parametrinen suunnittelutyokalu rakennusprojekteihin. Reaaliaikaiset hinnat, 3D-mallinnus ja AI-avustaja."
              : "Parametric design tool for building projects. Real-time prices, 3D modeling, and AI assistant."}
          </p>
        </div>

        <div className="landing-footer-sources">
          <div className="label-mono" style={{ color: "var(--text-muted)", marginBottom: 12, fontSize: 9 }}>
            {locale === "fi" ? "TIETOLAHTEET" : "DATA SOURCES"}
          </div>
          <div className="landing-footer-source-grid">
            {dataSources.map((s) => (
              <div key={s.name} className="landing-footer-source">
                <span style={{ fontWeight: 600, fontSize: 12, color: "var(--text-secondary)" }}>{s.name}</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="landing-footer-links">
          <div className="label-mono" style={{ color: "var(--text-muted)", marginBottom: 12, fontSize: 9 }}>
            {locale === "fi" ? "LINKIT" : "LINKS"}
          </div>
          <a href="/privacy" className="link-muted" style={{ fontSize: 12, display: "block", marginBottom: 8 }}>
            {locale === "fi" ? "Tietosuojakäytäntö" : "Privacy Policy"}
          </a>
          <a href="/terms" className="link-muted" style={{ fontSize: 12, display: "block", marginBottom: 8 }}>
            {locale === "fi" ? "Käyttöehdot" : "Terms of Service"}
          </a>
        </div>
      </div>
      </ScrollReveal>

      <ScrollReveal delay={0.15}>
      <div className="landing-footer-bottom">
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          &copy; {year} Helscoop.{" "}
          {locale === "fi"
            ? "Tietosi pysyvat EU:ssa."
            : "Your data stays in the EU."}
        </span>
        <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
          Helsinki, Finland
        </span>
      </div>
      </ScrollReveal>
    </footer>
  );
}
