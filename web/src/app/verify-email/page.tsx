"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { api } from "@/lib/api";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg("Vahvistustunniste puuttuu / Missing verification token");
      return;
    }

    api.verifyEmail(token)
      .then(() => setStatus("success"))
      .catch((err) => {
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "Vahvistus epaonnistui / Verification failed");
      });
  }, [token]);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 24px",
      background: "var(--bg-primary)",
    }}>
      <div className="card anim-up" style={{
        width: "100%",
        maxWidth: 420,
        padding: "40px 36px",
        textAlign: "center",
      }}>
        {status === "loading" && (
          <>
            <h1 className="heading-display" style={{ fontSize: 28, marginBottom: 16 }}>
              Vahvistetaan...
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
              Odota hetki / Please wait...
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>&#10003;</div>
            <h1 className="heading-display" style={{ fontSize: 28, marginBottom: 16 }}>
              Sahkoposti vahvistettu!
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
              Sahkopostiosoitteesi on nyt vahvistettu. Voit jatkaa Helscoopiin.
              <br />
              Your email has been verified. You can continue to Helscoop.
            </p>
            <a
              href="/"
              className="btn btn-primary"
              style={{ textDecoration: "none", padding: "13px 32px", fontSize: 14 }}
            >
              Jatka / Continue
            </a>
          </>
        )}

        {status === "error" && (
          <>
            <h1 className="heading-display" style={{ fontSize: 28, marginBottom: 16 }}>
              Vahvistus epaonnistui
            </h1>
            <div style={{
              padding: "10px 14px",
              borderRadius: "var(--radius-sm)",
              background: "var(--danger-dim)",
              color: "var(--danger)",
              fontSize: 13,
              border: "1px solid rgba(199,95,95,0.12)",
              marginBottom: 24,
            }}>
              {errorMsg}
            </div>
            <a
              href="/"
              className="btn btn-ghost"
              style={{ fontSize: 13, textDecoration: "none" }}
            >
              Takaisin etusivulle / Back to home
            </a>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-primary)",
        color: "var(--text-muted)",
      }}>
        Ladataan... / Loading...
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
