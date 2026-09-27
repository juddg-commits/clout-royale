/**
 * AutomationScene — the CONTENT STUDIO (M5 idle layer).
 * Launched OVER the paused HubScene exactly like the Gains Shop. Buy AI
 * automation units; collect accrued slop income with a deliberate button.
 *
 * Correctness rules (same rigor as the M4 shop):
 *  - Buys/collects require a pointerup hit-tested on their button.
 *  - Wall-clock input lock: the click that opened the studio can't transact.
 *  - Opening folds accrual IN MEMORY only (accurate display, no save write);
 *    storage changes exactly once per accepted transaction.
 */
import Phaser from 'phaser';
import { CONFIG } from '../data/config';
import { AUTOMATION_REGISTRY, type AutomationUnitDef } from '../data/automation';
import { AutomationSystem } from '../systems/AutomationSystem';
import { ProgressionSystem, type SaveData } from '../systems/ProgressionSystem';
import type { HubScene } from './HubScene';

export class AutomationScene extends Phaser.Scene {
  private save!: SaveData;
  private openedAt = 0;
  private uiObjects: Phaser.GameObjects.GameObject[] = [];
  /** Exposed for state-level verification. */
  purchases = 0;
  collections = 0;

  constructor() {
    super('AutomationScene');
  }

  create(): void {
    this.save = ProgressionSystem.load();
    // Display-accuracy fold: pending shown includes time since the last fold.
    // In-memory only — persisted when (and only when) a transaction lands.
    AutomationSystem.fold(this.save, Date.now(), 1);
    this.openedAt = Date.now(); // wall clock — see the M4 scene-clock lesson
    this.purchases = 0;
    this.collections = 0;
    this.uiObjects = [];

    const { WIDTH, HEIGHT } = CONFIG.CANVAS;
    const depth = CONFIG.UI.OVERLAY_DEPTH;
    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x000000, 0.78).setDepth(depth).setInteractive();
    this.add
      .text(WIDTH / 2, 56, 'CONTENT STUDIO', { fontFamily: 'monospace', fontSize: '34px', color: '#8d99ae', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(depth + 1);
    this.add
      .text(WIDTH / 2, 88, 'The content makes itself. Nobody watches it. The money is real.', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#8888aa',
      })
      .setOrigin(0.5)
      .setDepth(depth + 1);
    this.add
      .text(WIDTH / 2, HEIGHT - 34, '[ESC] back to the mansion', { fontFamily: 'monospace', fontSize: '14px', color: '#aaaacc' })
      .setOrigin(0.5)
      .setDepth(depth + 1);

    this.input.keyboard!.on('keydown-ESC', () => this.closeStudio());
    this.rebuild();
  }

  private closeStudio(): void {
    const hub = this.scene.get('HubScene') as HubScene;
    this.scene.stop();
    this.scene.resume('HubScene');
    hub.refreshHud();
  }

  /** Redraw balances, pending panel, and unit cards from the current save. */
  private rebuild(): void {
    for (const obj of this.uiObjects) obj.destroy();
    this.uiObjects = [];
    const { WIDTH } = CONFIG.CANVAS;
    const depth = CONFIG.UI.OVERLAY_DEPTH + 1;
    const auto = this.save.automation;
    const rates = AutomationSystem.rates(this.save);

    // Balances + farm rate
    this.uiObjects.push(
      this.add
        .text(WIDTH / 2, 120, `$${this.save.money}      Clout ${this.save.totalClout}`, {
          fontFamily: 'monospace',
          fontSize: '16px',
          color: '#ffffff',
        })
        .setOrigin(0.5)
        .setDepth(depth),
      this.add
        .text(WIDTH / 2, 144, `farm rate: $${rates.moneyPerMin.toFixed(2)}/min  +  ${rates.cloutPerMin.toFixed(2)} clout/min`, {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#8ecae6',
        })
        .setOrigin(0.5)
        .setDepth(depth),
    );

    // Pending panel + COLLECT button
    const pendingMoney = Math.floor(auto.pendingMoney);
    const pendingClout = Math.floor(auto.pendingClout);
    const collectable = pendingMoney > 0 || pendingClout > 0;
    const panel = this.add
      .rectangle(WIDTH / 2, 196, 720, 58, 0x1e1e30, 0.95)
      .setStrokeStyle(2, collectable ? 0xffd700 : 0x555577)
      .setDepth(depth);
    const pendingText = this.add
      .text(WIDTH / 2 - 340, 196, `UNCOLLECTED SLOP:  $${pendingMoney}  +  ${pendingClout} clout`, {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: collectable ? '#ffd700' : '#8888aa',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5)
      .setDepth(depth + 1);
    const collectBg = this.add
      .rectangle(WIDTH / 2 + 270, 196, 150, 44, collectable ? 0x2a3a1e : 0x22222e, 1)
      .setStrokeStyle(2, collectable ? 0x7cfc00 : 0x555577)
      .setDepth(depth + 1);
    const collectLabel = this.add
      .text(WIDTH / 2 + 270, 196, 'COLLECT', {
        fontFamily: 'monospace',
        fontSize: '15px',
        fontStyle: 'bold',
        color: collectable ? '#7cfc00' : '#666677',
      })
      .setOrigin(0.5)
      .setDepth(depth + 2);
    if (collectable) {
      collectBg.setInteractive({ useHandCursor: true });
      collectBg.on('pointerup', () => this.tryCollect());
    }
    this.uiObjects.push(panel, pendingText, collectBg, collectLabel);

    // Unit cards
    Object.values(AUTOMATION_REGISTRY).forEach((def, i) => {
      this.buildCard(def, WIDTH / 2, 272 + i * 100);
    });
  }

  private buildCard(def: AutomationUnitDef, x: number, y: number): void {
    const depth = CONFIG.UI.OVERLAY_DEPTH + 1;
    const rank = Math.min(this.save.automation.units[def.id] ?? 0, def.costs.length);
    const maxed = rank >= def.costs.length;
    const cost = maxed ? 0 : def.costs[rank];
    const balance = def.currency === 'money' ? this.save.money : this.save.totalClout;
    const affordable = !maxed && balance >= cost;
    const costLabel = def.currency === 'money' ? `$${cost}` : `${cost} clout`;
    const prodParts: string[] = [];
    if (def.production.moneyPerMin) prodParts.push(`$${def.production.moneyPerMin.toFixed(2)}/min`);
    if (def.production.cloutPerMin) prodParts.push(`${def.production.cloutPerMin.toFixed(2)}c/min`);

    const card = this.add
      .rectangle(x, y, 720, 88, 0x1e1e30, 0.95)
      .setStrokeStyle(2, maxed ? 0x2ecc71 : 0x555577)
      .setDepth(depth);
    const name = this.add
      .text(x - 340, y - 26, def.name, { fontFamily: 'monospace', fontSize: '17px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0, 0.5)
      .setDepth(depth + 1);
    const pips = this.add
      .text(x - 340, y - 4, '■'.repeat(rank) + '□'.repeat(def.costs.length - rank) + `   ${prodParts.join(' + ')} per rank`, {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#8d99ae',
      })
      .setOrigin(0, 0.5)
      .setDepth(depth + 1);
    const desc = this.add
      .text(x - 340, y + 20, def.description, { fontFamily: 'monospace', fontSize: '12px', color: '#aaaacc' })
      .setOrigin(0, 0.5)
      .setDepth(depth + 1);

    const buyBg = this.add
      .rectangle(x + 270, y, 150, 48, maxed ? 0x224422 : affordable ? 0x2a3a1e : 0x2a1e1e, 1)
      .setStrokeStyle(2, maxed ? 0x2ecc71 : affordable ? 0x7cfc00 : 0x884444)
      .setDepth(depth + 1);
    const buyLabel = this.add
      .text(x + 270, y, maxed ? 'MAXED' : `BUY ${costLabel}`, {
        fontFamily: 'monospace',
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
    this.uiObjects.push(card, name, pips, desc, buyBg, buyLabel);
  }

  /** One validated transaction per accepted click; exactly one save write. */
  private tryPurchase(def: AutomationUnitDef): void {
    if (Date.now() - this.openedAt < CONFIG.UI.SHOP.PURCHASE_INPUT_LOCK_MS) return;
    const rank = Math.min(this.save.automation.units[def.id] ?? 0, def.costs.length);
    if (rank >= def.costs.length) return;
    const cost = def.costs[rank];
    const balance = def.currency === 'money' ? this.save.money : this.save.totalClout;
    if (balance < cost) return;

    // Fold BEFORE the rank changes so the new rank never earns retroactively.
    AutomationSystem.fold(this.save, Date.now(), 1);
    if (def.currency === 'money') this.save.money -= cost;
    else this.save.totalClout -= cost;
    this.save.automation.units[def.id] = rank + 1;
    ProgressionSystem.save(this.save);
    this.purchases += 1;
    this.rebuild();
  }

  private tryCollect(): void {
    if (Date.now() - this.openedAt < CONFIG.UI.SHOP.PURCHASE_INPUT_LOCK_MS) return;
    AutomationSystem.fold(this.save, Date.now(), 1);
    const { money, clout } = AutomationSystem.collect(this.save);
    if (money <= 0 && clout <= 0) return; // nothing whole to collect — no write
    ProgressionSystem.save(this.save);
    this.collections += 1;
    this.rebuild();
  }
}
