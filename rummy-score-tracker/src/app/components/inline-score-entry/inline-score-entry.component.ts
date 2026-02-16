/**
 * =============================================================================
 * INLINE SCORE ENTRY COMPONENT
 * =============================================================================
 * 
 * This component provides inline score entry directly on the main screen.
 * No popup needed - scores are entered in a horizontal row of inputs.
 * 
 * Features:
 * 1. Text box for each active player
 * 2. "Drop" checkbox to quickly add drop points
 * 3. Empty input = 0 (player won the round)
 * 4. Submit button to add the round
 * 5. VALIDATION: Must have exactly one winner (0 points) to submit
 * 
 * Score Entry Rules:
 * - Leave empty for winner (0 points) - ONLY ONE ALLOWED
 * - Check "Drop" to auto-fill with drop points
 * - Enter custom score for other cases
 * - Cannot submit without exactly one winner
 */

import { Component, inject, signal, EventEmitter, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GameService } from '../../services/game.service';
import { RoundScore } from '../../models/game.model';

/**
 * Internal interface for tracking each player's score input state.
 */
interface ScoreEntry {
  playerId: string;
  playerName: string;
  score: number | null;  // null means empty (will be treated as 0)
  isDropped: boolean;    // If true, use drop points
}

@Component({
  selector: 'app-inline-score-entry',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="score-entry-container">
      <div class="entry-header">
        <h3>📝 Add Round {{ nextRoundNumber() }} Scores</h3>
        <p class="hint">
          Leave empty for winner (0 pts) • Check "Drop" for {{ gameService.settings().dropPoints }} pts
        </p>
      </div>

      <!-- Score entry row - horizontal scrollable -->
      <div class="score-entries">
        @for (entry of scoreEntries(); track entry.playerId; let i = $index) {
          <div class="entry-card" [class.winner]="isWinner(entry)" [class.dropped]="entry.isDropped">
            <!-- Player name -->
            <label class="player-name">{{ entry.playerName }}</label>
            
            <!-- Score input -->
            <div class="input-row">
              <input 
                type="number"
                class="score-input"
                [(ngModel)]="entry.score"
                (ngModelChange)="onScoreChange(entry)"
                [placeholder]="entry.isDropped ? gameService.settings().dropPoints.toString() : '0'"
                [disabled]="entry.isDropped"
                [tabindex]="entry.isDropped ? -1 : (i + 1)"
                (keydown.tab)="onTabPress($event, i)"
                min="0">
              
              <!-- Drop checkbox - no tab index -->
              <label class="drop-checkbox" [title]="'Add ' + gameService.settings().dropPoints + ' drop points'">
                <input 
                  type="checkbox"
                  [(ngModel)]="entry.isDropped"
                  (ngModelChange)="onDropChange(entry)"
                  tabindex="-1">
                <span class="drop-label">Drop</span>
              </label>
            </div>
          </div>
        }
      </div>

      <!-- Action buttons -->
      <div class="entry-actions">
        <button class="btn-clear" (click)="clearAll()">
          Clear All
        </button>
        <button 
          class="btn-submit" 
          [disabled]="!isValid()"
          [title]="!isValid() ? 'Select exactly one winner (leave empty or enter 0)' : ''"
          (click)="submitScores()">
          ✓ Add Round {{ nextRoundNumber() }}
        </button>
      </div>

      <!-- Validation message -->
      @if (validationMessage()) {
        <div class="validation-message" [class.error]="!isValid()" [class.success]="isValid()">
          {{ validationMessage() }}
        </div>
      }
    </div>
  `,
  styles: [`
    .score-entry-container {
      background: white;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .entry-header {
      margin-bottom: 12px;
    }

    .entry-header h3 {
      margin: 0 0 4px 0;
      font-size: 16px;
      color: #333;
    }

    .hint {
      margin: 0;
      font-size: 12px;
      color: #666;
    }

    /* Horizontal scrollable row of score entries */
    .score-entries {
      display: flex;
      gap: 10px;
      overflow-x: auto;
      padding: 8px 0;
      margin-bottom: 12px;
    }

    /* Individual player entry card */
    .entry-card {
      flex: 0 0 auto;
      min-width: 100px;
      padding: 10px;
      background: #f8f9fa;
      border-radius: 8px;
      border: 2px solid #e0e0e0;
      text-align: center;
      transition: all 0.2s;
    }

    /* Winner styling (green) */
    .entry-card.winner {
      border-color: #4caf50;
      background: #e8f5e9;
    }

    /* Dropped styling (orange) */
    .entry-card.dropped {
      border-color: #ff9800;
      background: #fff3e0;
    }

    .player-name {
      display: block;
      font-weight: 600;
      font-size: 13px;
      color: #333;
      margin-bottom: 6px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .input-row {
      display: flex;
      flex-direction: column;
      gap: 6px;
      align-items: center;
    }

    /* Score input field */
    .score-input {
      width: 70px;
      padding: 6px;
      border: 2px solid #e0e0e0;
      border-radius: 6px;
      font-size: 14px;
      text-align: center;
      transition: border-color 0.2s;
    }

    .score-input:focus {
      outline: none;
      border-color: #667eea;
    }

    .score-input:disabled {
      background: #fff3e0;
      border-color: #ff9800;
      color: #e65100;
    }

    /* Drop checkbox styling */
    .drop-checkbox {
      display: flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;
      font-size: 11px;
      color: #666;
    }

    .drop-checkbox input {
      width: 14px;
      height: 14px;
      cursor: pointer;
    }

    .drop-label {
      user-select: none;
    }

    /* Action buttons row */
    .entry-actions {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    }

    .btn-clear, .btn-submit {
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-clear {
      background: #e0e0e0;
      color: #333;
    }

    .btn-clear:hover {
      background: #d0d0d0;
    }

    .btn-submit {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .btn-submit:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .btn-submit:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Validation message */
    .validation-message {
      margin-top: 10px;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      text-align: center;
    }

    .validation-message.error {
      background: #ffebee;
      color: #c62828;
    }

    .validation-message.success {
      background: #e8f5e9;
      color: #2e7d32;
    }

    /* Responsive: wrap on smaller screens */
    @media (max-width: 600px) {
      .score-entries {
        flex-wrap: wrap;
        justify-content: center;
      }

      .entry-card {
        min-width: 90px;
      }

      .entry-actions {
        flex-direction: column;
      }

      .btn-clear, .btn-submit {
        width: 100%;
      }
    }
  `]
})
export class InlineScoreEntryComponent implements OnInit {
  
  /**
   * Event emitted when scores are submitted.
   * Contains array of RoundScore objects.
   */
  @Output() scoresAdded = new EventEmitter<RoundScore[]>();

  /** Inject game service */
  gameService = inject(GameService);

  // ==========================================================================
  // COMPONENT STATE
  // ==========================================================================

  /** Array of score entries, one per active player */
  scoreEntries = signal<ScoreEntry[]>([]);
  
  /** Validation message to display */
  validationMessage = signal('');

  /** Track player count for detecting changes */
  private lastPlayerCount = 0;

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  ngOnInit(): void {
    this.initializeEntries();
  }

  /**
   * Re-initialize when players change (count or order).
   */
  ngDoCheck(): void {
    const activePlayers = this.gameService.activePlayersWithTotals();
    
    // Check if players changed (count)
    if (activePlayers.length !== this.lastPlayerCount) {
      this.initializeEntries();
      this.lastPlayerCount = activePlayers.length;
      return;
    }
    
    // Check if order changed
    const currentEntries = this.scoreEntries();
    if (currentEntries.length === activePlayers.length) {
      for (let i = 0; i < activePlayers.length; i++) {
        if (currentEntries[i].playerId !== activePlayers[i].id) {
          this.initializeEntries();
          return;
        }
      }
    }
  }

  // ==========================================================================
  // METHODS
  // ==========================================================================

  /**
   * Gets the next round number for display.
   */
  nextRoundNumber(): number {
    return this.gameService.rounds().length + 1;
  }

  /**
   * Initializes score entries for all active players.
   * Called on init and when players change.
   * Uses activePlayersWithTotals to maintain consistent order with table and panel.
   */
  private initializeEntries(): void {
    const activePlayers = this.gameService.activePlayersWithTotals();
    this.scoreEntries.set(
      activePlayers.map(p => ({
        playerId: p.id,
        playerName: p.name,
        score: null,      // Empty = winner (0)
        isDropped: false
      }))
    );
    this.lastPlayerCount = activePlayers.length;
    this.updateValidation();
  }

  /**
   * Checks if an entry represents the winner (empty or 0).
   */
  isWinner(entry: ScoreEntry): boolean {
    return !entry.isDropped && (entry.score === null || entry.score === 0);
  }

  /**
   * Handles score input changes.
   * Unchecks drop if user manually enters a score.
   */
  onScoreChange(entry: ScoreEntry): void {
    if (entry.score !== null && entry.score > 0) {
      entry.isDropped = false;
    }
    this.updateValidation();
  }

  /**
   * Handles drop checkbox changes.
   * Sets score to drop points when checked.
   */
  onDropChange(entry: ScoreEntry): void {
    if (entry.isDropped) {
      entry.score = this.gameService.settings().dropPoints;
    } else {
      entry.score = null;
    }
    this.updateValidation();
  }

  /**
   * Updates validation message based on current entries.
   * REQUIRES exactly one winner to be valid.
   */
  private updateValidation(): void {
    const entries = this.scoreEntries();
    const winners = entries.filter(e => this.isWinner(e));
    
    if (winners.length === 0) {
      this.validationMessage.set('⚠️ Select a winner (leave one player empty or enter 0)');
    } else if (winners.length === 1) {
      this.validationMessage.set(`✓ ${winners[0].playerName} wins this round`);
    } else {
      this.validationMessage.set(`⚠️ Only one winner allowed (${winners.length} players have 0)`);
    }
  }

  /**
   * Clears all entries to default state.
   */
  clearAll(): void {
    this.initializeEntries();
  }

  /**
   * Handles tab key press to skip dropped inputs.
   * Finds the next non-dropped input and focuses it.
   */
  onTabPress(event: Event, currentIndex: number): void {
    const keyEvent = event as KeyboardEvent;
    const entries = this.scoreEntries();
    
    // Find next non-dropped entry
    let nextIndex = currentIndex + 1;
    while (nextIndex < entries.length && entries[nextIndex].isDropped) {
      nextIndex++;
    }
    
    // If we found a valid next entry, focus it
    if (nextIndex < entries.length) {
      keyEvent.preventDefault();
      // Use setTimeout to ensure DOM is ready
      setTimeout(() => {
        const inputs = document.querySelectorAll('.score-input:not(:disabled)');
        const enabledInputs = Array.from(inputs);
        // Find the input at the correct position among enabled inputs
        let enabledIndex = 0;
        for (let i = 0; i <= nextIndex; i++) {
          if (!entries[i].isDropped) {
            if (i === nextIndex) break;
            enabledIndex++;
          }
        }
        const nextInput = enabledInputs[enabledIndex] as HTMLInputElement;
        if (nextInput) {
          nextInput.focus();
        }
      }, 0);
    }
    // Otherwise, let default tab behavior continue (to buttons)
  }

  /**
   * Validates and returns whether form can be submitted.
   * REQUIRES exactly one winner (0 points).
   */
  isValid(): boolean {
    const entries = this.scoreEntries();
    const winners = entries.filter(e => this.isWinner(e));
    // Must have EXACTLY one winner
    return winners.length === 1;
  }

  /**
   * Submits the scores.
   * Converts entries to RoundScore format:
   * - Empty/null → 0 (winner)
   * - Dropped → drop points
   * - Otherwise → entered value
   */
  submitScores(): void {
    if (!this.isValid()) return;

    const entries = this.scoreEntries();
    
    // Convert to RoundScore format
    const scores: RoundScore[] = entries.map(entry => {
      let score: number;
      
      if (entry.isDropped) {
        // Dropped = drop points
        score = this.gameService.settings().dropPoints;
      } else if (entry.score === null || entry.score === 0) {
        // Empty or 0 = winner
        score = 0;
      } else {
        // Custom score
        score = entry.score;
      }
      
      return {
        playerId: entry.playerId,
        score
      };
    });

    this.scoresAdded.emit(scores);
    
    // Reset entries for next round
    this.initializeEntries();
  }
}
