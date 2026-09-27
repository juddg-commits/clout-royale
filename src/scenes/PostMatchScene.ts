/**
 * PostMatchScene — the creator feed (LIVE as of M6, filling the M1 stub).
 * After a match, the fake social feed "reacts" to the run: posts are picked
 * from FEED_POST_REGISTRY by declarative conditions on the MissionResult
 * (plus automation context), with fake engagement numbers.
 *
 * This scene is READ-ONLY: banking already happened in GameScene.endMatch.
 * It renders the result and hands off to the hub — zero save writes here.
 */
import Phaser from 'phaser';
import { CONFIG } from '../data/config';
import { MISSION_REGISTRY, elimsLabel, outcomePresentation, type MissionResult } from '../data/missions';
import { pickFeedPosts, type FeedPostDef } from '../data/posts';
import { ProgressionSystem } from '../systems/ProgressionSystem';

interface PostMatchData {
  result?: MissionResult;
}

export class PostMatchScene extends Phaser.Scene {
  private result?: MissionResult;
  private openedAt = 0;

  constructor() {
    super('PostMatchScene');
  }

  init(data: PostMatchData): void {
    this.result = data?.result;
  }

  create(): void {
    // Direct-start guard (dev tools, stale links): nothing to show, go home.
    if (!this.result) {
      this.scene.start('HubScene');
      return;
    }
    this.openedAt = Date.now(); // wall clock (see the M4 scene-clock lesson)

    const { WIDTH, HEIGHT } = CONFIG.CANVAS;
    const result = this.result;
    const save = ProgressionSystem.load(); // read-only: feed context + level display
    const mission = MISSION_REGISTRY[result.missionId];

    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x0b0b12).setDepth(0);
    this.add
      .text(WIDTH / 2, 44, 'THE FEED REACTS', { fontFamily: CONFIG.UI.FONT, fontSize: '32px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(1);

    const { title: outcomeLabel, color: outcomeColor } = outcomePresentation(result);
    const secs = Math.round(result.durationMs / 1000);
    this.add
      .text(
        WIDTH / 2,
        84,
        `${mission?.name ?? result.missionId} — ${outcomeLabel} · ${elimsLabel(result)} · ${secs}s\n` +
          `+$${result.moneyEarned} · +${result.cloutEarned} clout · +${result.xpEarned} XP` +
          (result.levelsGained > 0 ? ` · LEVEL UP → Lv ${save.level}` : ''),
        { fontFamily: CONFIG.UI.FONT, fontSize: '14px', color: outcomeColor, align: 'center', lineSpacing: 5 },
      )
      .setOrigin(0.5, 0)
      .setDepth(1);

    // --- The feed ---
    const posts = pickFeedPosts(
      result,
      { level: save.level, pendingMoney: save.automation.pendingMoney },
      CONFIG.UI.FEED.MAX_POSTS,
    );
    posts.forEach((post, i) => this.renderPost(post, i, result));

    // --- Continue ---
    const btnY = HEIGHT - 62;
    const btn = this.add
      .rectangle(WIDTH / 2, btnY, 320, 46, 0x1e1e30, 1)
      .setStrokeStyle(2, 0x7cfc00)
      .setDepth(1)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(WIDTH / 2, btnY, 'BACK TO THE MANSION', { fontFamily: CONFIG.UI.FONT, fontSize: '14px', color: '#7cfc00', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(2);
    btn.on('pointerup', () => this.leave());
    this.input.keyboard!.on('keydown-ESC', () => this.leave());
  }

  private leave(): void {
    // Same input lock family as the shops: the click that dismissed the
    // GameScene overlay can't also dismiss the feed.
    if (Date.now() - this.openedAt < CONFIG.UI.SHOP.PURCHASE_INPUT_LOCK_MS) return;
    this.scene.start('HubScene'); // feed already presented the result — no banner payload
  }

  private renderPost(post: FeedPostDef, index: number, result: MissionResult): void {
    const { WIDTH } = CONFIG.CANVAS;
    const feed = CONFIG.UI.FEED;
    const y = 190 + index * 108;

    const objective = MISSION_REGISTRY[result.missionId]?.objective;
    const objectiveTarget = objective && 'target' in objective ? objective.target : 0;
    const filled = post.text
      .replace('{elims}', `${result.eliminations}`)
      .replace('{pool}', `${result.totalPool}`)
      .replace('{money}', `${result.moneyEarned}`)
      .replace('{clout}', `${result.cloutEarned}`)
      .replace('{xp}', `${result.xpEarned}`)
      .replace('{level}', `${ProgressionSystem.load().level}`)
      .replace('{pending}', `${Math.floor(ProgressionSystem.load().automation.pendingMoney)}`)
      .replace('{collected}', `${result.smoothiesCollected}`)
      .replace('{target}', `${objectiveTarget}`);

    // Fake engagement — the roast economy pays best.
    let likes = feed.BASE_LIKES + result.eliminations * feed.LIKES_PER_ELIM + result.cloutEarned * feed.LIKES_PER_CLOUT;
    if (result.outcome === 'defeat') likes *= feed.DEFEAT_ENGAGEMENT_MULT;
    likes = Math.round(likes * Phaser.Math.FloatBetween(0.75, 1.25));
    const reposts = Math.round(likes * Phaser.Math.FloatBetween(0.1, 0.3));

    this.add.rectangle(WIDTH / 2, y, 760, 96, 0x16161f, 1).setStrokeStyle(1, 0x33334a).setDepth(1);
    const author = this.add
      .text(WIDTH / 2 - 360, y - 32, post.author, { fontFamily: CONFIG.UI.FONT, fontSize: '14px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0, 0.5)
      .setDepth(2);
    this.add
      .text(WIDTH / 2 - 360 + author.width + 8, y - 32, post.handle, { fontFamily: CONFIG.UI.FONT, fontSize: '13px', color: '#666688' })
      .setOrigin(0, 0.5)
      .setDepth(2);
    this.add
      .text(WIDTH / 2 - 360, y - 8, filled, {
        fontFamily: CONFIG.UI.FONT,
        fontSize: '13px',
        color: '#d8d8e8',
        wordWrap: { width: 700 },
      })
      .setOrigin(0, 0.5)
      .setDepth(2);
    this.add
      .text(WIDTH / 2 - 360, y + 30, `♥ ${likes.toLocaleString()}    ⇄ ${reposts.toLocaleString()}`, {
        fontFamily: CONFIG.UI.FONT,
        fontSize: '12px',
        color: '#666688',
      })
      .setOrigin(0, 0.5)
      .setDepth(2);
  }
}
