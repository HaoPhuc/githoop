import { topLanguageLogo } from "./github/languages";
import type { PlayerEntry } from "./registry";
import { FINISH_LABELS } from "./scoring/constants";
import type { Card } from "./scoring/types";

// The home fan's cards are baked (lib/github/samples) so the page never waits on
// GitHub, which also freezes their ratings. This lays a player's registry entry,
// updated on every rebuild of their card, over the baked card. No entry (no
// Redis, or a failed read) leaves the baked card as it is.
export function withLiveRating(card: Card, live: PlayerEntry | null | undefined): Card {
  if (!live) return card;
  return {
    ...card,
    name: live.name,
    avatarUrl: live.avatarUrl,
    overall: live.overall,
    position: live.position,
    family: live.family,
    finish: live.finish,
    finishLabel: FINISH_LABELS[live.finish],
    country: live.country,
    topLanguage: live.topLanguage,
    languageLogo: live.topLanguage === card.topLanguage ? card.languageLogo : topLanguageLogo(live.topLanguage ? [live.topLanguage] : []),
    stats: live.stats,
  };
}
