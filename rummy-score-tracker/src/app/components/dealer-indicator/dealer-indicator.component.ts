/**
 * =============================================================================
 * DEALER INDICATOR COMPONENT
 * =============================================================================
 * 
 * This component displays the current dealer and open card receiver.
 * It appears at the top of the main content area.
 * 
 * Features:
 * - Shows current dealer and open card receiver
 * - ALLOWS CHANGING THE DEALER via dropdown
 * - Open card automatically goes to the next player after dealer
 * 
 * Rummy Dealer/Open Card Concepts:
 * - Each round, one player "deals" (distributes) the cards
 * - Another player gets the "open card" (first card from the deck)
 * - The dealer is ALWAYS the player immediately BEFORE the open card receiver
 *   in the seating order (column order in the score table)
 * - After each round, the open card moves to the next player in order
 * - When a player goes "out", they're skipped in the rotation
 * 
 * Example:
 * - Players in order: A, B, C, D
 * - If C gets open card, then B is the dealer
 * - Next round: D gets open card, C is dealer
 * - If D goes out: A gets open card, C is still dealer (D skipped)
 */

import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GameService } from '../../services/game.service';

@Component({
  selector: 'app-dealer-indicator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- 
      Only show when there are at least 2 active players
      (need at least 2 for dealer rotation to make sense)
    -->
    @if (gameService.activePlayers().length >= 2) {
      <div class="dealer-indicator">
        
        <!-- Dealer info with change button -->
        <div class="indicator-item dealer">
          <span class="icon">🎴</span>
          <div class="info">
            <span class="label">Dealer</span>
            @if (showDealerSelect()) {
              <select 
                class="dealer-select"
                [ngModel]="gameService.currentDealer()?.id"
                (ngModelChange)="onDealerChange($event)">
                @for (player of gameService.activePlayers(); track player.id) {
                  <option [value]="player.id">{{ player.name }}</option>
                }
              </select>
            } @else {
              <span class="name clickable" (click)="showDealerSelect.set(true)" title="Click to change dealer">
                {{ gameService.currentDealer()?.name || '-' }}
                <span class="edit-icon">✏️</span>
              </span>
            }
          </div>
        </div>
        
        <!-- Visual divider -->
        <div class="divider"></div>
        
        <!-- Open card receiver info -->
        <div class="indicator-item open-card">
          <span class="icon">📤</span>
          <div class="info">
            <span class="label">Open Card</span>
            <span class="name">{{ gameService.currentOpenCardPlayer()?.name || '-' }}</span>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    /* Main container with purple gradient background */
    .dealer-indicator {
      display: flex;
      align-items: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 12px;
      padding: 16px 24px;
      color: white;
      gap: 24px;
    }

    /* Individual indicator item (dealer or open card) */
    .indicator-item {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    /* Large emoji icon */
    .icon {
      font-size: 28px;
    }

    /* Text info container */
    .info {
      display: flex;
      flex-direction: column;
    }

    /* Small uppercase label */
    .label {
      font-size: 12px;
      opacity: 0.8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* Player name */
    .name {
      font-size: 18px;
      font-weight: 600;
    }

    /* Clickable name for changing dealer */
    .name.clickable {
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .name.clickable:hover {
      text-decoration: underline;
    }

    .edit-icon {
      font-size: 12px;
      opacity: 0.7;
    }

    /* Dealer selection dropdown */
    .dealer-select {
      padding: 6px 10px;
      font-size: 14px;
      font-weight: 600;
      border: 2px solid rgba(255,255,255,0.5);
      border-radius: 6px;
      background: rgba(255,255,255,0.2);
      color: white;
      cursor: pointer;
    }

    .dealer-select option {
      color: #333;
      background: white;
    }

    /* Vertical divider between dealer and open card */
    .divider {
      width: 1px;
      height: 40px;
      background: rgba(255, 255, 255, 0.3);
    }

    /* Responsive: stack vertically on small screens */
    @media (max-width: 600px) {
      .dealer-indicator {
        flex-direction: column;
        gap: 12px;
        padding: 16px;
      }

      /* Horizontal divider on mobile */
      .divider {
        width: 100%;
        height: 1px;
      }

      .indicator-item {
        width: 100%;
      }
    }
  `]
})
export class DealerIndicatorComponent {
  
  /** Inject game service to access dealer/open card info */
  gameService = inject(GameService);

  /** Whether to show the dealer selection dropdown */
  showDealerSelect = signal(false);

  /**
   * Handles dealer change from dropdown.
   * Sets the new dealer and hides the dropdown.
   */
  onDealerChange(playerId: string): void {
    this.gameService.setDealer(playerId);
    this.showDealerSelect.set(false);
  }
}
