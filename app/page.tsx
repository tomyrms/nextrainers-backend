import { getSubscriptionInfo } from "@/lib/subscription";

export default function Home() {
  const sub = getSubscriptionInfo();
  const endpoints = [
    ["GET", "/api/subscription/info", "État premium (actif par défaut)"],
    ["POST", "/api/subscription/create-checkout", "Checkout instantané (rien n'est facturé)"],
    ["GET", "/api/user/profile · /onboarding · /currency · /tactics", "Profil coach (démo)"],
    ["GET", "/api/trainings · /api/exercises · /api/players", "Collections (mémoire)"],
    ["GET", "/api/season-plan · /season/sessions · /calendar · /next-match", "Saison"],
    ["GET", "/api/notifications/inbox · /preferences", "Notifications"],
    ["POST", "/api/season/generate · GET /api/generation/status", "Génération IA (à brancher)"],
    ["*", "/api/* (catch-all)", "{} — dégradation gracieuse"],
  ];
  return (
    <main style={{ background: "#121517", color: "#fff", minHeight: "100vh", padding: "48px 24px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <h1 style={{ fontSize: 26, marginBottom: 6 }}>
          nextrainers-backend <span style={{ color: "#7DE2CE" }}>— clone</span>
        </h1>
        <p style={{ color: "rgba(255,255,255,.55)", marginBottom: 28, fontSize: 14 }}>
          Backend du clone Nextrainers. Tu es la source de vérité : le premium est gratuit par construction.
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 32 }}>
          <span style={{ background: sub.isActive ? "#1d3a34" : "#3a1d24", border: "1px solid " + (sub.isActive ? "#7DE2CE55" : "#FF426755"), color: sub.isActive ? "#7DE2CE" : "#FF4267", borderRadius: 999, padding: "6px 14px", fontSize: 13, fontWeight: 600 }}>
            {sub.isActive ? "● Premium actif — illimité" : "● Tier gratuit"}
          </span>
          <span style={{ background: "#232A2F", border: "1px solid rgba(255,255,255,.12)", borderRadius: 999, padding: "6px 14px", fontSize: 13, color: "rgba(255,255,255,.7)" }}>
            Frontend miroir : localhost:4850
          </span>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <tbody>
            {endpoints.map(([m, path, note], i) => (
              <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,.08)" }}>
                <td style={{ padding: "10px 8px", color: "#7DE2CE", fontFamily: "ui-monospace, monospace", whiteSpace: "nowrap", verticalAlign: "top" }}>{m}</td>
                <td style={{ padding: "10px 8px", fontFamily: "ui-monospace, monospace", color: "rgba(255,255,255,.85)" }}>{path}</td>
                <td style={{ padding: "10px 8px", color: "rgba(255,255,255,.45)" }}>{note}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p style={{ color: "rgba(255,255,255,.35)", fontSize: 12, marginTop: 28, lineHeight: 1.7 }}>
          Suite de vérification : <code style={{ color: "rgba(255,255,255,.6)" }}>node ../scripts/verify-api.mjs</code>
          {" · "}SUBSCRIPTION_MODE=free pour simuler le tier gratuit.
        </p>
      </div>
    </main>
  );
}
