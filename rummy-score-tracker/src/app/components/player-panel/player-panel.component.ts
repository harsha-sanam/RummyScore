/**
 * =============================================================================
 * PLAYER PANEL COMPONENT
 * =============================================================================
 * 
 * This component displays on the RIGHT side of the screen and manages players.
 * 
 * Features:
 * 1. Add new players by name (in the order they pick cards)
 * 2. ADD PLAYERS MID-GAME: New players join with (highest score + 1)
 * 3. View all players with their current status and scores
 * 4. Remove players from the game (with confirmation)
 * 5. REJOIN: Out players can rejoin with total = highest + 1
 *    - Rejoin player gets the open card
 * 6. Visual indicators for player status:
 *    - ✓ Active players (green border)
 *    - ✗ Out players (gray, marked "OUT") with Rejoin button
 *    - Red name + ⚠️ for players who can't afford to drop
 * 
 * The order players are added determines the initial dealer rotation.
 */

import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { GameService } from '../../services/game.service';
import { PlayerWithTotal } from '../../models/game.model';

@Component({
  selector: 'app-player-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule],
  template: `
    <div class="player-panel">
      <h3>Players</h3>

      <!-- Players list - simple display -->
      <div class="players-list">
        @for (player of gameService.activePlayersWithTotals(); track player.id) {
          <div class="player-row">
            <span class="player-name">{{ player.name }}</span>
            <button 
              class="btn-remove"
              (click)="confirmRemove(player.id, player.name)"
              title="Remove player">
              ×
            </button>
          </div>
        }

        @for (player of getOutPlayersWithTotals(); track player.id) {
          <div class="player-row out">
            <span class="player-name">{{ player.name }}</span>
            <button 
              class="btn-remove"
              (click)="confirmRemove(player.id, player.name)"
              title="Remove player">
              ×
            </button>
          </div>
        }
      </div>

      <!-- Add player form -->
      <div class="add-player">
        <input 
          type="text"
          [(ngModel)]="newPlayerName"
          (ngModelChange)="onNameInputChange()"
          (keyup.enter)="addPlayer()"
          placeholder="Name"
          [class.error]="duplicateNameError()"
          maxlength="20">
        <button 
          class="btn-add"
          [disabled]="!newPlayerName.trim()"
          (click)="addPlayer()">
          Add
        </button>
      </div>
      
      <!-- Duplicate name error -->
      @if (duplicateNameError()) {
        <div class="error-message">{{ duplicateNameError() }}</div>
      }
    </div>

    <!-- 
      REMOVE CONFIRMATION DIALOG
      Appears when user clicks the X button on a player
      Requires confirmation to prevent accidental removal
    -->
    @if (showRemoveConfirm()) {
      <div class="confirm-overlay" (click)="cancelRemove()">
        <div class="confirm-dialog" (click)="$event.stopPropagation()">
          <p>Remove <strong>{{ playerToRemove()?.name }}</strong> from the game?</p>
          <p class="hint">This will delete all their scores.</p>
          <div class="confirm-buttons">
            <button class="btn-cancel" (click)="cancelRemove()">Cancel</button>
            <button class="btn-confirm" (click)="removePlayer()">Remove</button>
          </div>
        </div>
      </div>
    }

    <!-- 
      REJOIN CONFIRMATION DIALOG
      Appears when user clicks the rejoin button on an out player
    -->
    @if (showRejoinConfirm()) {
      <div class="confirm-overlay" (click)="cancelRejoin()">
        <div class="confirm-dialog rejoin-dialog" (click)="$event.stopPropagation()">
          <h4>↩️ Rejoin Game</h4>
          <p>Rejoin <strong>{{ playerToRejoin()?.name }}</strong> to the game?</p>
          <div class="rejoin-info">
            <p>New total score: <strong>{{ playerToRejoin()?.rejoinScore }}</strong> pts</p>
            <p class="hint">They will return to their original seat and get the open card.</p>
          </div>
          <div class="confirm-buttons">
            <button class="btn-cancel" (click)="cancelRejoin()">Cancel</button>
            <button class="btn-rejoin-confirm" (click)="rejoinPlayer()">Rejoin</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    /* Main panel container */
    .player-panel {
      height: fit-content;
    }

    h3 {
      margin: 0 0 16px 0;
      color: #333;
      font-size: 18px;
      font-weight: 500;
    }

    /* Players list */
    .players-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
    }

    /* Player row */
    .player-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 0;
    }

    .player-row.out {
      opacity: 0.5;
    }

    .player-name {
      font-size: 18px;
      color: #333;
    }

    /* Remove button (X) */
    .btn-remove {
      width: 24px;
      height: 24px;
      border: none;
      background: transparent;
      color: #e53935;
      font-size: 20px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .btn-remove:hover {
      color: #c62828;
    }

    /* Add player form */
    .add-player {
      display: flex;
      gap: 8px;
    }

    .add-player input {
      flex: 1;
      padding: 12px;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      font-size: 16px;
    }

    .add-player input:focus {
      outline: none;
      border-color: #4a7c59;
    }

    .add-player input.error {
      border-color: #e53935;
    }

    .btn-add {
      padding: 12px 24px;
      background: #1976d2;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }

    .btn-add:hover:not(:disabled) {
      background: #1565c0;
    }

    .btn-add:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Error message */
    .error-message {
      color: #e53935;
      font-size: 14px;
      margin-top: 8px;
    }

    /* Confirmation dialog overlay */
    .confirm-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .confirm-dialog {
      background: white;
      padding: 24px;
      border-radius: 8px;
      max-width: 320px;
      text-align: center;
    }

    .confirm-dialog p {
      margin: 0 0 8px 0;
      font-size: 16px;
    }

    .hint {
      font-size: 14px;
      color: #666;
    }

    .confirm-buttons {
      display: flex;
      gap: 12px;
      margin-top: 20px;
    }

    .btn-cancel, .btn-confirm {
      flex: 1;
      padding: 12px;
      border: none;
      border-radius: 4px;
      font-weight: 500;
      cursor: pointer;
      font-size: 14px;
    }

    .btn-cancel {
      background: #e0e0e0;
      color: #333;
    }

    .btn-confirm {
      background: #e53935;
      color: white;
    }

    /* Rejoin dialog */
    .rejoin-dialog h4 {
      margin: 0 0 12px 0;
      font-size: 18px;
      color: #333;
    }

    .rejoin-info {
      background: #e8f5e9;
      padding: 12px;
      border-radius: 4px;
      margin: 12px 0;
    }

    .rejoin-info p {
      margin: 4px 0;
      font-size: 14px;
    }

    .btn-rejoin-confirm {
      flex: 1;
      padding: 12px;
      border: none;
      border-radius: 4px;
      font-weight: 500;
      cursor: pointer;
      font-size: 14px;
      background: #4caf50;
      color: white;
    }

    .btn-rejoin-confirm:hover {
      background: #43a047;
    }
  `]
})
export class PlayerPanelComponent {
  
  /** Inject the game service for state management */
  gameService = inject(GameService);

  // ==========================================================================
  // COMPONENT STATE
  // ==========================================================================

  /** Current value of the "add player" input */
  newPlayerName = '';
  
  /** Whether the remove confirmation dialog is showing */
  showRemoveConfirm = signal(false);
  
  /** Player being considered for removal (for confirmation dialog) */
  playerToRemove = signal<{ id: string; name: string } | null>(null);

  /** Whether the rejoin confirmation dialog is showing */
  showRejoinConfirm = signal(false);

  /** Player being considered for rejoin (for confirmation dialog) */
  playerToRejoin = signal<{ id: string; name: string; rejoinScore: number } | null>(null);

  /** Error message for duplicate player name */
  duplicateNameError = signal('');

  // ==========================================================================
  // METHODS
  // ==========================================================================

  /**
   * Gets out players with their totals for display.
   */
  getOutPlayersWithTotals(): PlayerWithTotal[] {
    return this.gameService.playersWithTotals().filter(p => p.isOut);
  }

  /**
   * Handles drag-and-drop reordering of active players.
   */
  onPlayerDrop(event: CdkDragDrop<PlayerWithTotal[]>): void {
    if (event.previousIndex === event.currentIndex) {
      return;
    }

    // Get current active players order
    const players = [...this.gameService.activePlayersWithTotals()];
    
    // Reorder based on drag
    moveItemInArray(players, event.previousIndex, event.currentIndex);
    
    // Update game service with new order
    const newOrder = players.map(p => p.id);
    this.gameService.reorderPlayers(newOrder);
  }

  /**
   * Gets the score a new player would join with.
   * Returns highest active score + 1, or 0 if no rounds played.
   */
  getJoinScore(): number {
    const highest = this.gameService.getHighestActiveScore();
    return highest > 0 ? highest + 1 : 0;
  }

  /**
   * Gets the score a rejoining player would have.
   * Returns highest active score + 1.
   */
  getRejoinScore(): number {
    return this.gameService.getHighestActiveScore() + 1;
  }

  /**
   * Checks if a player can rejoin.
   * They can only rejoin IMMEDIATELY after going out (before next round).
   * Also checks if their new total (highest+1) + drop <= max
   */
  canRejoin(player: { id: string; isOut: boolean; totalScore: number; canRejoin?: boolean }): boolean {
    // Use the pre-computed canRejoin from the service
    return player.canRejoin === true;
  }

  /**
   * Shows the rejoin confirmation dialog.
   */
  confirmRejoin(playerId: string, playerName: string): void {
    const rejoinScore = this.getRejoinScore();
    this.playerToRejoin.set({ id: playerId, name: playerName, rejoinScore });
    this.showRejoinConfirm.set(true);
  }

  /**
   * Cancels the rejoin operation and closes the dialog.
   */
  cancelRejoin(): void {
    this.showRejoinConfirm.set(false);
    this.playerToRejoin.set(null);
  }

  /**
   * Confirms rejoin of the player and closes the dialog.
   * Their total score becomes highest + 1.
   * They return to their original position.
   * They get the open card.
   */
  rejoinPlayer(): void {
    const player = this.playerToRejoin();
    if (player) {
      this.gameService.rejoinPlayer(player.id);
    }
    this.cancelRejoin();
  }

  /**
   * Adds a new player with the name from the input.
   * If game is in progress (rounds played), adds join score.
   * Clears the input after adding.
   * Shows error if name is duplicate.
   */
  addPlayer(): void {
    const name = this.newPlayerName.trim();
    if (name) {
      // Clear any previous error
      this.duplicateNameError.set('');
      
      // Check for duplicate name
      if (this.gameService.isPlayerNameTaken(name)) {
        this.duplicateNameError.set(`"${name}" already exists!`);
        return;
      }
      
      const added = this.gameService.addPlayer(name);
      
      if (added) {
        // If game is in progress, add their join score
        const rounds = this.gameService.rounds();
        if (rounds.length > 0) {
          const joinScore = this.getJoinScore();
          if (joinScore > 0) {
            // Add a round entry for the joining player
            this.gameService.addJoinScoreForNewPlayer(name, joinScore);
          }
        }
        
        this.newPlayerName = '';  // Clear input
      }
    }
  }

  /**
   * Clears the duplicate name error when input changes.
   */
  onNameInputChange(): void {
    this.duplicateNameError.set('');
  }

  /**
   * Generates tooltip text explaining why a player can't drop.
   * Shows the calculation: current + drop = total > max
   * 
   * @param player - Player to generate tooltip for
   * @returns Tooltip string
   */
  getCannotDropTooltip(player: { totalScore: number }): string {
    const settings = this.gameService.settings();
    const afterDrop = player.totalScore + settings.dropPoints;
    return `Cannot drop! Current: ${player.totalScore} + Drop: ${settings.dropPoints} = ${afterDrop} > ${settings.maxPoints}`;
  }

  /**
   * Shows the remove confirmation dialog for a player.
   * 
   * @param id - Player ID
   * @param name - Player name (for display in dialog)
   */
  confirmRemove(id: string, name: string): void {
    this.playerToRemove.set({ id, name });
    this.showRemoveConfirm.set(true);
  }

  /**
   * Cancels the remove operation and closes the dialog.
   */
  cancelRemove(): void {
    this.showRemoveConfirm.set(false);
    this.playerToRemove.set(null);
  }

  /**
   * Confirms removal of the player and closes the dialog.
   * Calls the game service to actually remove the player.
   */
  removePlayer(): void {
    const player = this.playerToRemove();
    if (player) {
      this.gameService.removePlayer(player.id);
    }
    this.cancelRemove();
  }
}
