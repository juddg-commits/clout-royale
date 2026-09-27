# Clout Royale

A satirical top-down arena game about the creator economy, built in **TypeScript + Phaser 3**.

You play a gym influencer defending your mansion from waves of parody creator archetypes. Every fight is a content opportunity: eliminations earn money and clout, your **Aura** meter powers your abilities, and your **Cringe** meter slows you down when you overdo it. Between missions you buy upgrades, ride the AirWon smoothie trend, and run an idle content farm that keeps earning while you're away.

> Solo project. All characters and brands are parody; no real people or platforms.

## Play

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production bundle in dist/
npm run preview    # serve the production build
```

**Controls:** WASD move · mouse aim · left click attack · Q / E / Shift / R abilities · E interact (hub) · ESC close menus

## Missions

| Mission | Objective | Twist |
|---|---|---|
| Mansion Lockdown | Eliminate 5 rivals | Fixed pool of 9 enemies in 3 waves, no respawns |
| Livestream Marathon | Survive 2:30 | Waves loop until the timer runs out; the timer is the win |
| Trend Chaser | Collect 8 smoothies | Every grab pumps the trend. Chain too fast and it goes *Washed*, which spikes Cringe and slows you, so pacing is the skill |

Missions unlock in order. The objective is a data field on the mission (`eliminate` / `survive` / `collect`), and the win-condition code is shared.

## Systems

- **Aura / Cringe / Clout meters.** Aura is spent to cast the Q ability and scales its damage and cone width. Cringe above 70 slows movement; the Touch Grass Backyard zone drains it.
- **Four abilities:** a cone attack that steals Aura, a timed parry that reflects damage, a damaging dash, and an ultimate that trades a temporary buff for a Cringe spike when it ends.
- **Trend heat.** Smoothie grabs move the AirWon trend through Underground → Viral → Mainstream → Washed. Heat decays over time and the payout depends on the current stage, so timing matters.
- **Wave AI with an aggro cap.** At most two bots attack at once; the rest hover at standoff range and orbit.
- **Progression.** XP curve to level 67, separate money and clout currencies, a four-item upgrade shop.
- **Idle automation.** Content-farm units earn over real time. Accrual is timestamp-driven rather than timer-driven: it is folded forward at boot, purchase, collect, match end, and page hide, with an 8-hour offline cap at half rate.
- **Post-match feed.** A fake social feed reacts to the run. Posts are picked from a registry by declarative conditions (outcome, victory type, objective, eliminations, level-ups, trend peak).
- **Persistence.** Save data lives in `localStorage` with a version field and a defaults merge on load.

## Architecture

```
src/
  main.ts              Phaser game config, scene list, pagehide save hook
  data/
    config.ts          Every tunable number (no magic numbers elsewhere)
    classes.ts         Playable class registry
    abilities.ts       Ability registry (each id maps to an executor in AbilitySystem)
    upgrades.ts        Upgrade registry + computeUpgradeMods()
    automation.ts      Idle unit registry + computeAutomationRates()
    missions.ts        Mission registry, objectives, unlock gates, outcome labels
    posts.ts           Popups, bot voice lines, feed post registry + picker
  entities/            Player, Bot (AI), HubAvatar
  systems/             Combat, Ability, Effects, Progression, Automation, Trend
  scenes/              Boot → Hub ⇄ Game → PostMatch, plus Upgrade and Automation overlays
```

Rules the code follows:

- **Data-driven registries.** New classes, abilities, upgrades, missions, automation units, and feed posts are new entries, not new code paths.
- **One source of truth for numbers.** Everything tunable is in `config.ts` and referenced from the registries.
- **Explicit callbacks between systems** instead of scene events, so scene restarts can't leak handlers.
- **One save write per accepted transaction**, with a wall-clock input lock so the click that opens a shop can't also buy.

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`, which builds the game and publishes `dist/` to GitHub Pages. In the repo settings, set **Pages → Source** to **GitHub Actions** once.

## Status

Playable prototype: one arena, one class, three missions. Placeholder art (generated shapes), no audio.
