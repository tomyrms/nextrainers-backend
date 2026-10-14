// Deterministic match-analysis tips for POST /api/analysis/:id/generate-tips.
// The real backend asks an LLM; the clone derives coaching tips from the two
// formations so the same analysis always yields the same advice.
import type { Analysis, AnalysisTip } from "./seed";

type Lines = { def: number; mid: number; att: number };

// "4-2-3-1" -> defenders 4, midfielders 5, attackers 1 (best effort).
function lines(formation: string): Lines {
  const parts = formation.split("-").map(Number).filter((n) => Number.isFinite(n) && n > 0);
  if (parts.length < 2) return { def: 4, mid: 4, att: 2 };
  return { def: parts[0], mid: parts.slice(1, -1).reduce((a, b) => a + b, 0), att: parts[parts.length - 1] };
}

export function buildTips(analysis: Analysis): AnalysisTip[] {
  const us = lines(analysis.teamFormation);
  const them = lines(analysis.opponentTeamFormation);
  const opp = analysis.opponentTeamName;
  const tips: AnalysisTip[] = [];

  if (them.def === 3) {
    tips.push({
      id: "t_wide",
      category: "attack",
      title: "Attaquer les couloirs",
      body: `${opp} défend à 3 : écartez le jeu et attaquez l'espace entre le central et le piston, surtout après un renversement.`,
    });
  } else {
    tips.push({
      id: "t_halfspaces",
      category: "attack",
      title: "Occuper les demi-espaces",
      body: `Face à la ligne de ${them.def} de ${opp}, placez un joueur entre latéral et central pour fixer et créer le décalage.`,
    });
  }

  if (us.mid < them.mid) {
    tips.push({
      id: "t_midblock",
      category: "defense",
      title: "Compenser l'infériorité au milieu",
      body: `${opp} aligne ${them.mid} milieux contre ${us.mid} : resserrez le bloc et faites décrocher un attaquant sur leur sentinelle.`,
    });
  } else {
    tips.push({
      id: "t_press",
      category: "defense",
      title: "Presser la première relance",
      body: `Avec ${us.mid} milieux contre ${them.mid}, montez d'un cran sur la relance adverse et orientez-la vers un côté.`,
    });
  }

  tips.push({
    id: "t_transition",
    category: "transition",
    title: them.att >= 2 ? "Sécuriser la perte de balle" : "Projeter vite après récupération",
    body:
      them.att >= 2
        ? `${opp} garde ${them.att} joueurs devant : gardez toujours deux défenseurs + une sentinelle derrière le ballon.`
        : `Un seul attaquant chez ${opp} : à la récupération, jouez vers l'avant en moins de trois passes.`,
  });

  tips.push({
    id: "t_setpieces",
    category: "setPieces",
    title: "Coups de pied arrêtés",
    body: "Préparez deux combinaisons sur corner et désignez un joueur pour bloquer le gardien sur les centres rentrants.",
  });

  return tips;
}
