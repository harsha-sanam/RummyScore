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
      <h3>👥 Players</h3>

      <!-- 
        ADD PLAYER FORM
        Simple input + button to add new players
        Mid-game: new players join with highest score + 1
      -->
      <div class="add-player">
        <input 
          type="text"
          [(ngModel)]="newPlayerName"
          (ngModelChange)="onNameInputChange()"
          (keyup.enter)="addPlayer()"
          placeholder="Enter player name"
          [class.error]="duplicateNameError()"
          maxlength="20">
        <button 
          class="btn-add"
          [disabled]="!newPlayerName.trim()"
          (click)="addPlayer()">
          + Add
        </button>
      </div>
      
      <!-- Duplicate name error -->
      @if (duplicateNameError()) {
        <div class="error-message">{{ duplicateNameError() }}</div>
      }

      <!-- Mid-game join info -->
      @if (gameService.rounds().length > 0 && getJoinScore() > 0) {
        <div class="mid-game-info">
          ℹ️ New players join with {{ getJoinScore() }} pts
        </div>
      }

      <!-- 
        PLAYERS LIST
        Shows ALL players - active players first (draggable), out players at bottom
      -->
      <div class="players-list">
        <!-- Drag hint if there are active players -->
        @if (gameService.activePlayersWithTotals().length > 1) {
          <div class="drag-hint-bar">⋮⋮ Drag to reorder</div>
        }

        <!-- ACTIVE PLAYERS - Draggable -->
        <div 
          class="players-drop-zone"
          cdkDropList
          (cdkDropListDropped)="onPlayerDrop($event)">
          @for (player of gameService.activePlayersWithTotals(); track player.id) {
            <div 
              cdkDrag
              class="player-card"
              [class.cannot-drop]="!player.canDrop">
              
              <!-- Drag handle -->
              <div class="drag-handle" cdkDragHandle>⋮⋮</div>
              
              <!-- Player info: name -->
              <div class="player-info">
                <span class="player-name" [class.red]="!player.canDrop">
                  {{ player.name }}
                  @if (player.rejoinCount > 0) {
                    <span class="rejoin-count" [title]="'Rejoined ' + player.rejoinCount + ' time(s)'">
                      ↩️{{ player.rejoinCount }}
                    </span>
                  }
                  @if (!player.canDrop) {
                    <span class="warning-icon" [title]="getCannotDropTooltip(player)">⚠️</span>
                  }
                </span>
              </div>
              
              <!-- Score and remove button -->
              <div class="player-actions">
                <span class="score">{{ player.totalScore }}</span>
                <button 
                  class="btn-remove"
                  (click)="confirmRemove(player.id, player.name)"
                  title="Remove player">
                  ×
                </button>
              </div>
              
              <!-- Drag placeholder -->
              <div *cdkDragPlaceholder class="player-placeholder"></div>
            </div>
          }
        </div>

        <!-- OUT PLAYERS - Not draggable, shown at the bottom -->
        @for (player of getOutPlayersWithTotals(); track player.id) {
          <div class="player-card out">
            <!-- Spacer to align with drag handle -->
            <div class="drag-handle-spacer"></div>
            
            <!-- Player info: name -->
            <div class="player-info">
              <span class="player-name">
                {{ player.name }}
                @if (player.rejoinCount > 0) {
                  <span class="rejoin-count" [title]="'Rejoined ' + player.rejoinCount + ' time(s)'">
                    ↩️{{ player.rejoinCount }}
                  </span>
                }
              </span>
            </div>
            
            <!-- OUT label with Rejoin button -->
            <div class="player-actions">
              <span class="out-badge">OUT</span>
              <span class="out-score">({{ player.totalScore }})</span>
              @if (canRejoin(player)) {
                <button 
                  class="btn-rejoin"
                  (click)="confirmRejoin(player.id, player.name)"
                  [title]="'Rejoin with ' + getRejoinScore() + ' pts'">
                  ↩️
                </button>
              }
              <button 
                class="btn-remove"
                (click)="confirmRemove(player.id, player.name)"
                title="Remove player">
                ×
              </button>
            </div>
          </div>
        }

        <!-- Empty state when no players added yet -->
        @if (gameService.players().length === 0) {
          <div class="empty-state">
            <p>No players yet</p>
            <p class="hint">Add players in the order they pick cards</p>
          </div>
        }
      </div>

      <!-- Stats footer showing active/out counts -->
      @if (gameService.players().length > 0) {
        <div class="panel-stats">
          <p>Active: {{ gameService.activePlayers().length }}</p>
          <p>Out: {{ gameService.outPlayers().length }}</p>
        </div>
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
      background: white;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      height: fit-content;
    }

    h3 {
      margin: 0 0 12px 0;
      color: #333;
      font-size: 16px;
    }

    /* Add player form row */
    .add-player {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
    }

    .add-player input {
      flex: 1;
      padding: 8px 10px;
      border: 2px solid #e0e0e0;
      border-radius: 6px;
      font-size: 13px;
    }

    .add-player input:focus {
      outline: none;
      border-color: #667eea;
    }

    .btn-add {
      padding: 8px 12px;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .btn-add:hover:not(:disabled) {
      background: #5a6fd6;
    }

    .btn-add:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Error state for input */
    .add-player input.error {
      border-color: #f44336;
    }

    /* Error message */
    .error-message {
      color: #f44336;
      font-size: 11px;
      margin-bottom: 8px;
      padding: 4px 8px;
      background: #ffebee;
      border-radius: 4px;
    }

    /* Mid-game join info */
    .mid-game-info {
      background: #e3f2fd;
      color: #1565c0;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      margin-bottom: 12px;
    }

    /* Scrollable list of player cards */
    .players-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-height: 300px;
      overflow-y: auto;
    }

    /* Drag hint bar */
    .drag-hint-bar {
      font-size: 10px;
      color: #999;
      text-align: right;
      padding: 2px 0;
    }

    /* Players drop zone for active players */
    .players-drop-zone {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    /* Individual player card */
    .player-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 10px;
      background: #f8f9fa;
      border-radius: 6px;
      border-left: 3px solid #4caf50;  /* Green = active */
      transition: all 0.2s;
      cursor: grab;
    }

    .player-card:active {
      cursor: grabbing;
    }

    /* Drag handle */
    .drag-handle {
      color: #999;
      font-size: 12px;
      cursor: grab;
      padding-right: 6px;
      user-select: none;
    }

    .drag-handle:hover {
      color: #667eea;
    }

    /* Out player styling */
    .player-card.out {
      border-left-color: #9e9e9e;  /* Gray = out */
      opacity: 0.7;
      cursor: default;
    }

    /* Cannot drop warning styling */
    .player-card.cannot-drop {
      border-left-color: #f44336;  /* Red = danger */
    }

    /* Drag placeholder */
    .player-placeholder {
      background: #e3f2fd;
      border: 2px dashed #667eea;
      border-radius: 6px;
      height: 40px;
    }

    /* CDK drag styles */
    .cdk-drag-preview {
      background: white;
      border-radius: 6px;
      border-left: 3px solid #667eea;
      padding: 8px 10px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .cdk-drag-animating {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }

    .players-drop-zone.cdk-drop-list-dragging .player-card:not(.cdk-drag-placeholder) {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }

    /* Spacer to align out players with active players (where drag handle would be) */
    .drag-handle-spacer {
      width: 18px;
      flex-shrink: 0;
    }

    .player-info {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      flex: 1;
    }

    .player-name {
      font-weight: 500;
      color: #333;
      font-size: 13px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Red text for players who can't drop */
    .player-name.red {
      color: #f44336;
    }

    .warning-icon {
      cursor: help;
      margin-left: 2px;
      font-size: 12px;
    }

    /* Rejoin count badge */
    .rejoin-count {
      font-size: 10px;
      background: #e3f2fd;
      color: #1565c0;
      padding: 1px 4px;
      border-radius: 3px;
      margin-left: 4px;
      cursor: help;
    }

    .player-actions {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }

    .score {
      font-weight: 600;
      color: #667eea;
      font-size: 13px;
    }

    /* OUT badge */
    .out-badge {
      font-size: 10px;
      font-weight: 600;
      color: white;
      background: #9e9e9e;
      padding: 2px 6px;
      border-radius: 3px;
    }

    .out-score {
      font-size: 11px;
      color: #999;
    }

    /* Rejoin button */
    .btn-rejoin {
      width: 24px;
      height: 24px;
      border: none;
      background: #4caf50;
      color: white;
      font-size: 12px;
      cursor: pointer;
      border-radius: 4px;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .btn-rejoin:hover {
      background: #43a047;
    }

    /* Remove button (X) */
    .btn-remove {
      width: 22px;
      height: 22px;
      border: none;
      background: transparent;
      color: #999;
      font-size: 16px;
      cursor: pointer;
      border-radius: 4px;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .btn-remove:hover {
      background: #ffebee;
      color: #f44336;
    }

    /* Empty state when no players */
    .empty-state {
      text-align: center;
      padding: 20px;
      color: #666;
    }

    .empty-state p {
      margin: 4px 0;
      font-size: 13px;
    }

    .hint {
      font-size: 11px;
      color: #999;
    }

    /* Stats footer */
    .panel-stats {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #e0e0e0;
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: #666;
    }

    .panel-stats p {
      margin: 0;
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
      padding: 20px;
      border-radius: 12px;
      max-width: 300px;
      text-align: center;
    }

    .confirm-dialog p {
      margin: 0 0 8px 0;
      font-size: 14px;
    }

    .confirm-buttons {
      display: flex;
      gap: 10px;
      margin-top: 16px;
    }

    .btn-cancel, .btn-confirm {
      flex: 1;
      padding: 10px;
      border: none;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      font-size: 13px;
    }

    .btn-cancel {
      background: #e0e0e0;
      color: #333;
    }

    .btn-confirm {
      background: #f44336;
      color: white;
    }

    /* Rejoin dialog specific styles */
    .rejoin-dialog h4 {
      margin: 0 0 12px 0;
      font-size: 16px;
      color: #333;
    }

    .rejoin-info {
      background: #e8f5e9;
      padding: 10px;
      border-radius: 6px;
      margin: 12px 0;
    }

    .rejoin-info p {
      margin: 4px 0;
      font-size: 13px;
    }

    .btn-rejoin-confirm {
      flex: 1;
      padding: 10px;
      border: none;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      font-size: 13px;
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
