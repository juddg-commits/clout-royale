/**
 * UpgradeScene — the GAINS SHOP (LIVE as of M4).
 * Launched OVER the paused HubScene (scene.launch + scene.pause) so the hub —
 * and the avatar's position — survive underneath. ESC closes and resumes.
 *
 * Purchase correctness rules (see the M4 phantom-pointer notes):
 *  - Buying requires a pointerup hit-tested on a BUY button.
 *  - Purchases are ignored for PURCHASE_INPUT_LOCK_MS after opening, so the
 *    click/keypress that opened the shop can never also buy.
 *  - The handler re-validates rank + balance inside the click and performs
 *    exactly one deduction and one save write per accepted purchase.
 */
import Phaser from 'phaser';
import { CONFIG } from '../data/config';
import { UPGRADE_REGISTRY, type UpgradeDef } from '../data/upgrades';
import { ProgressionSystem, type SaveData } from '../systems/ProgressionSystem';
import type { HubScene } from './HubScene';

export class UpgradeScene extends Phaser.Scene {
  private save!: SaveData;
  private openedAt = 0;
  private cardObjects: Phaser.GameObjects.GameObject[] = [];
  private balanceText!: Phaser.GameObjects.Text;
  private escKey!: Phaser.Input.Keyboard.Key;
  /** Exposed for state-level verification: accepted purchases this visit. */
  purchases = 0;

  constructor() {
    super('UpgradeScene');
  }

  create(): void {
    this.save = ProgressionSystem.load();
    // Wall clock, NOT this.time.now: the scene clock hasn't ticked during
    // create() of a freshly-launched scene (reads ~0), which would make the
    // purchase lock window appear already expired.
    this.openedAt = Date.now();
    this.purchases = 0;
    this.cardObjects = [];

    const { WIDTH, HEIGHT } = CONFIG.CANVAS;
    const depth = CONFIG.UI.OVERLAY_DEPTH;
    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x000000, 0.78).setDepth(depth).setInteractive();
    this.add
      .text(WIDTH / 2, 70, 'GAINS SHOP', { fontFamily: CONFIG.UI.FONT, fontSize: '36px', color: '#ffa94d', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(depth + 1);
    this.add
      .text(WIDTH / 2, 104, 'Results not typical. Results not guaranteed.', { fontFamily: CONFIG.UI.FONT, fontSize: '13px', color: '#8888aa' })
      .setOrigin(0.5)
      .setDepth(depth + 1);
    this.balanceText = this.add
      .text(WIDTH / 2, 136, '', { fontFamily: CONFIG.UI.FONT, fontSize: '17px', color: '#ffffff' })
      .setOrigin(0.5)
      .setDepth(depth + 1);
    this.add
      .text(WIDTH / 2, HEIGHT - 48, '[ESC] back to the mansion', { fontFamily: CONFIG.UI.FONT, fontSize: '14px', color: '#aaaacc' })
      .setOrigin(0.5)
      .setDepth(depth + 1);

    this.escKey = this.input.keyboard!.addKey('ESC');
    this.rebuild();
  }

  update(): void {
    if (Phaser.Input.Keyboard.JustDown(this.escKey)) this.closeShop();
  }

  private closeShop(): void {
    const hub = this.scene.get('HubScene') as HubScene;
    this.scene.stop();
    this.scene.resume('HubScene');
    hub.refreshHud(); // balances changed while the hub was paused
  }

  /** Redraw balances + all cards from the current save (called per purchase). */
  private rebuild(): void {
    this.balanceText.setText(`$${this.save.money}      Clout ${this.save.totalClout}`);
    for (const obj of this.cardObjects) obj.destroy();
    this.cardObjects = [];
    Object.values(UPGRADE_REGISTRY).forEach((def, i) => {
      this.buildCard(def, CONFIG.CANVAS.WIDTH / 2, 200 + i * 110);
    });
  }

  private buildCard(def: UpgradeDef, x: number, y: number): void {
    const depth = CONFIG.UI.OVERLAY_DEPTH + 1;
    const rank = Math.min(this.save.upgrades[def.id] ?? 0, def.costs.length);
    const maxed = rank >= def.costs.length;
    const cost = maxed ? 0 : def.costs[rank];
    const balance = def.currency === 'money' ? this.save.money : this.save.totalClout;
    const affordable = !maxed && balance >= cost;
    const costLabel = def.currency === 'money' ? `$${cost}` : `${cost} clout`;

    const card = this.add
      .rectangle(x, y, 720, 96, 0x1e1e30, 0.95)
      .setStrokeStyle(2, maxed ? 0x2ecc71 : 0x555577)
      .setDepth(depth);
    const name = this.add
      .text(x - 340, y - 30, def.name, { fontFamily: CONFIG.UI.FONT, fontSize: '18px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0, 0.5)
      .setDepth(depth + 1);
    const pips = this.add
      .text(x - 340, y - 6, '■'.repeat(rank) + '□'.repeat(def.costs.length - rank), {
        fontFamily: CONFIG.UI.FONT,
        fontSize: '15px',
        color: '#ffa94d',
      })
      .setOrigin(0, 0.5)
      .setDepth(depth + 1);
    const desc = this.add
      .text(x - 340, y + 20, def.description, { fontFamily: CONFIG.UI.FONT, fontSize: '12px', color: '#aaaacc' })
      .setOrigin(0, 0.5)
      .setDepth(depth + 1);

    const buyBg = this.add
      .rectangle(x + 270, y, 150, 52, maxed ? 0x224422 : affordable ? 0x2a3a1e : 0x2a1e1e, 1)
      .setStrokeStyle(2, maxed ? 0x2ecc71 : affordable ? 0x7cfc00 : 0x884444)
      .setDepth(depth + 1);
    const buyLabel = this.add
      .text(x + 270, y, maxed ? 'MAXED' : `BUY ${costLabel}`, {
        fontFamily: CONFIG.UI.FONT,
        fontSize: '14px',
        fontStyle: 'bold',
        color: maxed ? '#2ecc71' : affordable ? '#7cfc00' : '#cc6666',
      })
      .setOrigin(0.5)
      .setDepth(depth + 2);

    if (!maxed) {
      buyBg.setInteractive({ useHandCursor: affordable });
      buyBg.on('pointerup', () => this.tryPurchase(def));
    }
    this.cardObjects.push(card, name, pips, desc, buyBg, buyLabel);
  }

  /** One validated transaction per accepted click. */
  private tryPurchase(def: UpgradeDef): void {
    if (Date.now() - this.openedAt < CONFIG.UI.SHOP.PURCHASE_INPUT_LOCK_MS) return; // opening click can't buy
    const rank = Math.min(this.save.upgrades[def.id] ?? 0, def.costs.length);
    if (rank >= def.costs.length) return;
    const cost = def.costs[rank];
    const balance = def.currency === 'money' ? this.save.money : this.save.totalClout;
    if (balance < cost) return;

    if (def.currency === 'money') this.save.money -= cost;
    else this.save.totalClout -= cost;
    this.save.upgrades[def.id] = rank + 1;
    ProgressionSystem.save(this.save); // exactly one write per purchase
    this.purchases += 1;
    this.rebuild();
  }
}
