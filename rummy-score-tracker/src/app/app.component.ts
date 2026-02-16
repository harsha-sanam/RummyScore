/**
 * =============================================================================
 * APP COMPONENT - Main Application Component
 * =============================================================================
 * 
 * This is the root component of the Rummy Score Tracker application.
 * It orchestrates all child components and handles the main application flow.
 * 
 * Layout Structure (OPTIMIZED FOR NO SCROLLING):
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  HEADER: Title, game info badges, action buttons                        │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │  MAIN CONTENT                              │  RIGHT SIDEBAR             │
 * │  ├─ Dealer Indicator (always visible)      │  └─ Player Panel           │
 * │  ├─ Score Table (SCROLLABLE, fixed height) │     (add players anytime)  │
 * │  ├─ Inline Score Entry (always visible)    │                            │
 * │  └─ Game Over Banner (when applicable)     │                            │
 * └─────────────────────────────────────────────────────────────────────────┘
 * 
 * Key Features:
 * - Score table scrolls independently (max 300px height)
 * - Dealer indicator and score entry always visible
 * - No rejoin - out players stay out until new game
 * - New players can join mid-game with highest+1 score
 */

import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameService } from './services/game.service';
import { ConfettiService } from './services/confetti.service';
import { GameSetupModalComponent } from './components/game-setup-modal/game-setup-modal.component';
import { PlayerPanelComponent } from './components/player-panel/player-panel.component';
import { ScoreTableComponent } from './components/score-table/score-table.component';
import { InlineScoreEntryComponent } from './components/inline-score-entry/inline-score-entry.component';
import { RoundScore, PlayerWithTotal } from './models/game.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    GameSetupModalComponent,
    PlayerPanelComponent,
    ScoreTableComponent,
    InlineScoreEntryComponent
  ],
  template: `
    <!-- 
      =========================================================================
      GAME SETUP MODAL
      Shown on first load or after reset. Collects max points and drop points.
      =========================================================================
    -->
    @if (gameService.needsSetup()) {
      <app-game-setup-modal 
        (gameStarted)="onGameStarted($event)">
      </app-game-setup-modal>
    }

    <!-- 
      =========================================================================
      MAIN APPLICATION CONTAINER
      Blurred when setup modal is showing
      =========================================================================
    -->
    <div class="app-container" [class.blurred]="gameService.needsSetup()">
      
      <!-- 
        HEADER
        Clean header with title and reset button
      -->
      <header class="app-header">
        <h1>Score App</h1>
        <button class="btn-reset" (click)="confirmReset()">Reset</button>
      </header>

      <!-- 
        MAIN CONTENT AREA
        Two-column layout: score area on left, info panel on right
      -->
      <main class="main-content">
        
        <!-- LEFT/CENTER SECTION - Score Entry and Table -->
        <div class="content-left">
          
          <!-- Score Table and Entry Combined -->
          <app-score-table 
            (scoreEdited)="onScoreEdited($event)">
          </app-score-table>

          <!-- 
            INLINE SCORE ENTRY
            Only shown when at least 2 active players and game not over
          -->
          @if (gameService.activePlayers().length >= 2 && !gameService.isGameOver()) {
            <app-inline-score-entry
              (scoresAdded)="onScoresAdded($event)">
            </app-inline-score-entry>
          }

          <!-- 
            Game Over Banner
          -->
          @if (gameService.isGameOver()) {
            <div class="game-over-banner">
              @if (getGameWinner(); as winner) {
                <h2>🏆 Game Over!</h2>
                <p><strong>{{ winner.name }}</strong> wins the game!</p>
              } @else {
                <h2>Game Over</h2>
                <p>All players are out.</p>
              }
              <button class="btn-primary" (click)="confirmNewGame()">
                Start New Game
              </button>
            </div>
          }
        </div>

        <!-- RIGHT SIDEBAR - Info Panel -->
        <aside class="content-right">
          <!-- Game Info -->
          <div class="info-panel">
            <div class="info-item">
              <span class="info-label">Total Points :</span>
              <span class="info-value">{{ gameService.settings().maxPoints }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Games :</span>
              <span class="info-value">{{ gameService.rounds().length }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Next :</span>
              <span class="info-value">{{ getNextPlayerName() }}</span>
            </div>
          </div>

          <!-- Player Panel -->
          <app-player-panel></app-player-panel>
        </aside>
      </main>
    </div>

    <!-- 
      =========================================================================
      CONFIRMATION DIALOGS
      =========================================================================
    -->

    <!-- New Game Confirmation -->
    @if (showNewGameConfirm()) {
      <div class="confirm-overlay" (click)="cancelNewGameConfirm()">
        <div class="confirm-dialog" (click)="$event.stopPropagation()">
          <h3>🔄 Start New Game?</h3>
          <p>This will clear all scores but keep players and settings.</p>
          <div class="confirm-buttons">
            <button class="btn-cancel" (click)="cancelNewGameConfirm()">Cancel</button>
            <button 
              class="btn-confirm" 
              [disabled]="newGameCountdown() > 0"
              (click)="newGame()">
              @if (newGameCountdown() > 0) {
                Wait {{ newGameCountdown() }}s
              } @else {
                New Game
              }
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Reset Everything Confirmation -->
    @if (showResetConfirm()) {
      <div class="confirm-overlay" (click)="cancelResetConfirm()">
        <div class="confirm-dialog" (click)="$event.stopPropagation()">
          <h3>🗑️ Reset Everything?</h3>
          <p>This will delete all players, scores, and settings. You'll need to set up the game again.</p>
          <div class="confirm-buttons">
            <button class="btn-cancel" (click)="cancelResetConfirm()">Cancel</button>
            <button 
              class="btn-danger" 
              [disabled]="resetCountdown() > 0"
              (click)="resetEverything()">
              @if (resetCountdown() > 0) {
                Wait {{ resetCountdown() }}s
              } @else {
                Reset All
              }
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Rejoin Popup - shown after adding scores if players went out -->
    @if (showRejoinPopup()) {
      <div class="confirm-overlay" (click)="closeRejoinPopup()">
        <div class="rejoin-popup" (click)="$event.stopPropagation()">
          <h3>↩️ Players Out!</h3>
          <p>The following player(s) exceeded {{ gameService.settings().maxPoints }} points and went out.</p>
          <p class="rejoin-hint">They can rejoin now with {{ getRejoinScore() }} points total.</p>
          
          <div class="rejoin-players-list">
            @for (player of playersToRejoin(); track player.id) {
              <div class="rejoin-player-card">
                <div class="player-info">
                  <span class="player-name">{{ player.name }}</span>
                  <span class="player-score">Score: {{ player.totalScore }}</span>
                </div>
                <button class="btn-rejoin" (click)="onRejoinPlayer(player.id)">
                  ↩️ Rejoin
                </button>
              </div>
            }
          </div>

          <div class="rejoin-actions">
            <button class="btn-skip" (click)="closeRejoinPopup()">
              Skip - Stay Out
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    /* Main app container */
    .app-container {
      min-height: 100vh;
      background: #f5f5f5;
    }

    /* Blur effect when setup modal is showing */
    .app-container.blurred {
      filter: blur(4px);
      pointer-events: none;
    }

    /* 
      HEADER STYLES - Clean green header
    */
    .app-header {
      background: #4a7c59;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .app-header h1 {
      margin: 0;
      font-size: 20px;
      color: white;
      font-weight: 500;
    }

    .btn-reset {
      padding: 8px 20px;
      background: #e53935;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-reset:hover {
      background: #c62828;
    }

    /* 
      MAIN CONTENT LAYOUT
    */
    .main-content {
      display: grid;
      grid-template-columns: 1fr 280px;
      gap: 0;
      padding: 20px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .content-left {
      display: flex;
      flex-direction: column;
      gap: 20px;
      padding-right: 20px;
      border-right: 1px solid #e0e0e0;
    }

    .content-right {
      padding-left: 20px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    /* Info Panel */
    .info-panel {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .info-item {
      display: flex;
      gap: 8px;
      font-size: 18px;
      color: #333;
    }

    .info-label {
      font-weight: 400;
    }

    .info-value {
      font-weight: 500;
    }

    /* Game Over Banner */
    .game-over-banner {
      background: linear-gradient(135deg, #ffd700 0%, #ffb300 100%);
      padding: 24px;
      border-radius: 8px;
      text-align: center;
    }

    .game-over-banner h2 {
      margin: 0 0 8px 0;
      font-size: 24px;
      color: #333;
    }

    .game-over-banner p {
      margin: 0 0 16px 0;
      font-size: 18px;
      color: #333;
    }

    .btn-primary {
      padding: 12px 24px;
      background: #4a7c59;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-primary:hover {
      background: #3d6b4a;
    }

    .btn-danger {
      background: #e53935;
      color: white;
    }

    .btn-danger:hover {
      background: #c62828;
    }

    /* 
      CONFIRMATION DIALOG STYLES
    */
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
      border-radius: 12px;
      max-width: 360px;
      text-align: center;
    }

    .confirm-dialog h3 {
      margin: 0 0 10px 0;
      font-size: 18px;
    }

    .confirm-dialog p {
      margin: 0 0 20px 0;
      color: #666;
      font-size: 14px;
    }

    .confirm-buttons {
      display: flex;
      gap: 10px;
    }

    .btn-cancel, .btn-confirm {
      flex: 1;
      padding: 10px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-cancel {
      background: #e0e0e0;
      color: #333;
    }

    .btn-confirm {
      background: #667eea;
      color: white;
    }

    .btn-confirm:disabled,
    .btn-danger:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    /* 
      REJOIN POPUP STYLES
    */
    .rejoin-popup {
      background: white;
      padding: 24px;
      border-radius: 12px;
      max-width: 400px;
      width: 90%;
    }

    .rejoin-popup h3 {
      margin: 0 0 12px 0;
      font-size: 20px;
      color: #333;
      text-align: center;
    }

    .rejoin-popup p {
      margin: 0 0 8px 0;
      color: #666;
      font-size: 14px;
      text-align: center;
    }

    .rejoin-hint {
      background: #e8f5e9;
      color: #2e7d32 !important;
      padding: 8px 12px;
      border-radius: 6px;
      font-weight: 500;
      margin-bottom: 16px !important;
    }

    .rejoin-players-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 16px;
    }

    .rejoin-player-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: #f8f9fa;
      border-radius: 8px;
      border-left: 4px solid #ff9800;
    }

    .rejoin-player-card .player-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .rejoin-player-card .player-name {
      font-weight: 600;
      font-size: 15px;
      color: #333;
    }

    .rejoin-player-card .player-score {
      font-size: 12px;
      color: #666;
    }

    .rejoin-player-card .btn-rejoin {
      padding: 8px 16px;
      background: #4caf50;
      color: white;
      border: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .rejoin-player-card .btn-rejoin:hover {
      background: #43a047;
    }

    .rejoin-actions {
      display: flex;
      justify-content: center;
    }

    .btn-skip {
      padding: 10px 24px;
      background: #e0e0e0;
      color: #333;
      border: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-skip:hover {
      background: #d0d0d0;
    }

    /* 
      RESPONSIVE STYLES
    */
    @media (max-width: 900px) {
      .main-content {
        grid-template-columns: 1fr;
        padding: 16px;
      }

      .content-left {
        border-right: none;
        padding-right: 0;
        padding-bottom: 20px;
        border-bottom: 1px solid #e0e0e0;
      }

      .content-right {
        padding-left: 0;
        padding-top: 20px;
      }
    }
  `]
})
export class AppComponent {
  
  // ==========================================================================
  // SERVICE INJECTIONS
  // ==========================================================================

  /** Game state and logic service */
  gameService = inject(GameService);
  
  /** Confetti celebration service */
  confettiService = inject(ConfettiService);

  // ==========================================================================
  // COMPONENT STATE
  // ==========================================================================

  /** Whether to show the "New Game" confirmation dialog */
  showNewGameConfirm = signal(false);
  
  /** Whether to show the "Reset Everything" confirmation dialog */
  showResetConfirm = signal(false);

  /** Countdown timer for New Game button (5 seconds) */
  newGameCountdown = signal(0);

  /** Countdown timer for Reset All button (5 seconds) */
  resetCountdown = signal(0);

  /** Whether to show the rejoin popup */
  showRejoinPopup = signal(false);

  /** Players eligible for rejoin (shown in popup) */
  playersToRejoin = signal<PlayerWithTotal[]>([]);

  // ==========================================================================
  // EVENT HANDLERS
  // ==========================================================================

  /**
   * Handles game setup completion.
   * Called when user submits the setup modal.
   * 
   * @param event - Contains maxPoints and dropPoints from setup form
   */
  onGameStarted(event: { maxPoints: number; dropPoints: number }): void {
    this.gameService.initializeGame(event.maxPoints, event.dropPoints);
  }

  /**
   * Handles new round scores being added.
   * Called when user submits scores from the inline score entry.
   * Shows rejoin popup if any players went out and can rejoin.
   * 
   * @param scores - Array of scores for each player
   */
  onScoresAdded(scores: RoundScore[]): void {
    // Add round to game state
    this.gameService.addRound(scores);
    
    // Check for round winner (score = 0) and celebrate
    const winner = scores.find(s => s.score === 0);
    if (winner) {
      const player = this.gameService.players().find(p => p.id === winner.playerId);
      if (player) {
        this.confettiService.celebrateRoundWin(player.name);
      }
    }

    // Check if any players can rejoin and show popup
    this.checkForRejoinEligiblePlayers();

    // Check if this round ended the game
    this.checkGameWinner();
  }

  /**
   * Checks if any players are eligible for rejoin and shows the popup.
   */
  private checkForRejoinEligiblePlayers(): void {
    const eligiblePlayers = this.gameService.playersWithTotals()
      .filter(p => p.canRejoin === true);
    
    if (eligiblePlayers.length > 0) {
      this.playersToRejoin.set(eligiblePlayers);
      this.showRejoinPopup.set(true);
    }
  }

  /**
   * Handles rejoin for a player from the popup.
   */
  onRejoinPlayer(playerId: string): void {
    this.gameService.rejoinPlayer(playerId);
    
    // Update the list of players to rejoin
    const remaining = this.playersToRejoin().filter(p => p.id !== playerId);
    this.playersToRejoin.set(remaining);
    
    // Close popup if no more players to rejoin
    if (remaining.length === 0) {
      this.showRejoinPopup.set(false);
    }
  }

  /**
   * Closes the rejoin popup without rejoining.
   */
  closeRejoinPopup(): void {
    this.showRejoinPopup.set(false);
    this.playersToRejoin.set([]);
  }

  /**
   * Gets the rejoin score for display.
   */
  getRejoinScore(): number {
    return this.gameService.getHighestActiveScore() + 1;
  }

  /**
   * Handles score edits from the score table.
   * Called when user clicks a cell and changes the value.
   * 
   * @param event - Contains roundId, playerId, and newScore
   */
  onScoreEdited(event: { roundId: number; playerId: string; newScore: number }): void {
    this.gameService.updateScore(event.roundId, event.playerId, event.newScore);
    this.checkGameWinner();
  }

  /**
   * Checks if the game is over and celebrates if there's a winner.
   * Shows confetti for the game winner.
   */
  private checkGameWinner(): void {
    if (this.gameService.isGameOver()) {
      const winner = this.getGameWinner();
      if (winner) {
        // Delay celebration slightly for better UX
        setTimeout(() => {
          this.confettiService.celebrateGameWin(winner.name);
        }, 500);
      }
    }
  }

  /**
   * Gets the game winner's info.
   * 
   * @returns Object with winner's name, or null if no winner
   */
  getGameWinner(): { name: string } | null {
    const winnerId = this.gameService.gameWinnerId();
    if (!winnerId) return null;
    
    const player = this.gameService.players().find(p => p.id === winnerId);
    return player ? { name: player.name } : null;
  }

  /**
   * Gets the name of the next player to receive open card.
   */
  getNextPlayerName(): string {
    const player = this.gameService.currentOpenCardPlayer();
    return player ? player.name : '-';
  }

  // ==========================================================================
  // CONFIRMATION DIALOG HANDLERS
  // ==========================================================================

  /** Interval ID for new game countdown */
  private newGameIntervalId: ReturnType<typeof setInterval> | null = null;

  /** Interval ID for reset countdown */
  private resetIntervalId: ReturnType<typeof setInterval> | null = null;

  /**
   * Shows the "New Game" confirmation dialog with 5-second countdown.
   */
  confirmNewGame(): void {
    this.showNewGameConfirm.set(true);
    this.startNewGameCountdown();
  }

  /**
   * Starts the 5-second countdown for New Game button.
   */
  private startNewGameCountdown(): void {
    this.newGameCountdown.set(5);
    this.newGameIntervalId = setInterval(() => {
      const current = this.newGameCountdown();
      if (current > 0) {
        this.newGameCountdown.set(current - 1);
      } else {
        this.clearNewGameCountdown();
      }
    }, 1000);
  }

  /**
   * Clears the new game countdown interval.
   */
  private clearNewGameCountdown(): void {
    if (this.newGameIntervalId) {
      clearInterval(this.newGameIntervalId);
      this.newGameIntervalId = null;
    }
  }

  /**
   * Cancels the new game confirmation and clears countdown.
   */
  cancelNewGameConfirm(): void {
    this.showNewGameConfirm.set(false);
    this.clearNewGameCountdown();
    this.newGameCountdown.set(0);
  }

  /**
   * Starts a new game (clears scores, keeps players/settings).
   * Called when user confirms in the dialog after countdown.
   */
  newGame(): void {
    if (this.newGameCountdown() > 0) return;
    this.gameService.newGame();
    this.cancelNewGameConfirm();
  }

  /**
   * Shows the "Reset Everything" confirmation dialog with 5-second countdown.
   */
  confirmReset(): void {
    this.showResetConfirm.set(true);
    this.startResetCountdown();
  }

  /**
   * Starts the 5-second countdown for Reset All button.
   */
  private startResetCountdown(): void {
    this.resetCountdown.set(5);
    this.resetIntervalId = setInterval(() => {
      const current = this.resetCountdown();
      if (current > 0) {
        this.resetCountdown.set(current - 1);
      } else {
        this.clearResetCountdown();
      }
    }, 1000);
  }

  /**
   * Clears the reset countdown interval.
   */
  private clearResetCountdown(): void {
    if (this.resetIntervalId) {
      clearInterval(this.resetIntervalId);
      this.resetIntervalId = null;
    }
  }

  /**
   * Cancels the reset confirmation and clears countdown.
   */
  cancelResetConfirm(): void {
    this.showResetConfirm.set(false);
    this.clearResetCountdown();
    this.resetCountdown.set(0);
  }

  /**
   * Resets everything (clears all data, returns to setup).
   * Called when user confirms in the dialog after countdown.
   */
  resetEverything(): void {
    if (this.resetCountdown() > 0) return;
    this.gameService.resetEverything();
    this.cancelResetConfirm();
  }
}
