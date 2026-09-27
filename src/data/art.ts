/**
 * Art manifest: which image file backs each texture key.
 *
 * Art: Kenney "Top-down Shooter" pack (CC0 1.0 public domain, kenney.nl),
 * files under public/assets/kenney/. Characters use unarmed poses.
 *
 * BootScene preloads every entry. Gameplay code only ever names texture
 * keys, so art can be swapped here without touching it. If a file fails to
 * load, mansion.ts generates a stand-in for character/floor keys and skips
 * missing decor, so the game degrades to shapes instead of crashing.
 */
const K = 'kenney/';
const tile = (n: string) => `${K}tiles/tile_${n}.png`;

export const ART_MANIFEST: Record<string, string> = {
  // Characters — the player + one per bot archetype (keys match CONFIG.BOTS.ARCHETYPES ids)
  player: `${K}characters/manBlue_hold.png`,
  'bot-cryptoBro': `${K}characters/hitman1_stand.png`,
  'bot-npcStreamer': `${K}characters/robot1_stand.png`,
  'bot-wellnessGuru': `${K}characters/womanGreen_stand.png`,
  'bot-dropshipper': `${K}characters/manBrown_stand.png`,

  // Floors
  floor: tile('43'), // wood planks: the mansion itself
  'floor-gym': tile('93'),
  'floor-kitchen': tile('12'),
  'floor-lightwood': tile('96'),
  'floor-deck': tile('07'),
  'floor-water': tile('19'),
  'floor-grass': tile('01'),
  'floor-studio': tile('11'),

  // Decor
  'decor-bench': tile('483'),
  'decor-sink': tile('323'),
  'decor-stove': tile('296'),
  'decor-ringlight': tile('132'),
  'decor-rug': tile('511'),
  'decor-couch-left': tile('447'),
  'decor-couch-mid': tile('448'),
  'decor-couch-right': tile('449'),
  'decor-bush': tile('183'),
  'decor-bush-orange': tile('186'),
  'decor-bush-small': tile('235'),
  'decor-plant': tile('210'),
  'decor-desk': tile('507'),
};
