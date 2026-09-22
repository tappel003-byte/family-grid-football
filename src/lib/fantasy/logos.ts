import banthas from "@/assets/team-logos/banthas.png.asset.json";
import marauders from "@/assets/team-logos/marauders.png.asset.json";
import bizzerBees from "@/assets/team-logos/bizzer-bees.png.asset.json";
import milkMan from "@/assets/team-logos/milk-man.png.asset.json";
import homerun from "@/assets/team-logos/homerun-touchdown.png.asset.json";
import whatsHappening from "@/assets/team-logos/whats-happening.png.asset.json";
import cowboyDudes from "@/assets/team-logos/cowboy-dudes.png.asset.json";
import pooperBellies from "@/assets/team-logos/pooper-bellies.png.asset.json";
import maxPack from "@/assets/team-logos/max-pack.png.asset.json";
import madAppel from "@/assets/team-logos/mad-appel.png.asset.json";

const BY_KEY: Record<string, string> = {
  bizzerbeez: bizzerBees.url,
  scottsdalebanthas: banthas.url,
  milkman: milkMan.url,
  placitaspooperbellies: pooperBellies.url,
  scottsdalemaraders: marauders.url,
  cowboydudes: cowboyDudes.url,
  whatshappeningagain: whatsHappening.url,
  homeruntouchdown: homerun.url,
  maxpack: maxPack.url,
  madappel: madAppel.url,
};

const BY_SLOT = [
  bizzerBees.url,
  banthas.url,
  milkMan.url,
  pooperBellies.url,
  marauders.url,
  cowboyDudes.url,
  whatsHappening.url,
  homerun.url,
  maxPack.url,
  madAppel.url,
];

function key(name: string) {
  return name
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/[^a-z]/g, "");
}

/** Helmet logo for a team, matched by name and falling back to its slot. */
export function teamLogo(name: string | undefined, slot?: number): string | undefined {
  if (name) {
    const hit = BY_KEY[key(name)];
    if (hit) return hit;
  }
  if (typeof slot === "number" && slot >= 0 && slot < BY_SLOT.length) return BY_SLOT[slot];
  return undefined;
}
