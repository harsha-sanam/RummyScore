/**
 * =============================================================================
 * SCORE TABLE COMPONENT
 * =============================================================================
 * 
 * This component displays the main score tracking table in the CENTER of the screen.
 * 
 * Features:
 * 1. Displays rounds as rows, players as columns
 * 2. DRAG-AND-DROP column reordering (changes seating/rotation order)
 * 3. Click any cell to EDIT the score
 * 4. Shows TOTALS IN HEADER next to player names: "Name (Total)"
 * 5. SCROLLABLE table with fixed height - recent rounds visible
 * 6. Visual indicators:
 *    - 🎉 for round winners (score = 0)
 *    - Red name + ⚠️ for players who can't drop
 * 7. Only shows ACTIVE players (out players are hidden)
 * 
 * IMPORTANT: Column order determines dealer/open card rotation!
 * When user drags columns, it changes the actual seating arrangement.
 */

import { Component, inject, signal, EventEmitter, Output, ElementRef, ViewChild, AfterViewChecked, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { GameService } from '../../services/game.service';
import { PlayerWithTotal, RoundScore } from '../../models/game.model';

interface ScoreEntry {
  playerId: string;
  score: string;
}

@Component({
  selector: 'app-score-table',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule],
  template: `
    <div class="score-table-container">
      
      <!-- Empty state when no active players -->
      @if (gameService.activePlayers().length === 0) {
        <div class="empty-state">
          <div class="empty-icon">📊</div>
          <h3>No Active Players</h3>
          <p>Add players from the panel on the right to start tracking scores</p>
        </div>
      } @else {
        
        <!-- Main table with header, history, and input row -->
        <div class="table-wrapper" #tableWrapper>
          <table class="score-table">
            
            <!-- TABLE HEADER - Player names with totals -->
            <thead>
              <tr class="header-row">
                <th class="round-col"></th>
                <th class="players-header-cell" [attr.colspan]="gameService.activePlayersWithTotals().length">
                  <div 
                    class="players-drop-zone"
                    cdkDropList 
                    cdkDropListOrientation="horizontal"
                    (cdkDropListDropped)="onColumnDrop($event)">
                    
                    @for (player of gameService.activePlayersWithTotals(); track player.id; let i = $index) {
                      <div 
                        cdkDrag
                        class="player-col-header"
                        [class.cannot-drop]="!player.canDrop"
                        [attr.data-index]="i">
                        
                        <div class="player-header" cdkDragHandle>
                          <span class="drag-handle">⋮⋮</span>
                          <div class="player-info">
                            <span class="player-name" [class.red]="!player.canDrop">
                              {{ player.name }}
                              @if (!player.canDrop) {
                                <span class="warning-icon" [title]="getCannotDropTooltip(player)">⚠️</span>
                              }
                            </span>
                            <span class="player-total">({{ player.totalScore }})</span>
                          </div>
                        </div>
                        
                        <div *cdkDragPlaceholder class="drag-placeholder"></div>
                      </div>
                    }
                  </div>
                </th>
              </tr>
            </thead>
            
            <!-- TABLE BODY - Score input row + history rows -->
            <tbody>
              <!-- SCORE INPUT ROW - Always at top -->
              @if (!gameService.isGameOver()) {
                <tr class="input-row">
                  <td class="round-col"></td>
                  <td class="scores-cell" [attr.colspan]="gameService.activePlayersWithTotals().length">
                    <div class="scores-row">
                      @for (player of gameService.activePlayersWithTotals(); track player.id; let i = $index) {
                        <div class="score-input-cell">
                          <input 
                            type="text"
                            class="score-entry-input"
                            [(ngModel)]="scoreEntries()[i].score"
                            placeholder=""
                            (keyup.enter)="submitScores()">
                        </div>
                      }
                    </div>
                  </td>
                </tr>
              }

              <!-- HISTORY ROWS - Previous rounds -->
              @for (round of gameService.rounds(); track round.id) {
                <tr class="score-row" [class.editable]="isEditableRound(round.id)">
                  <td class="round-col">{{ round.id }}</td>
                  <td class="scores-cell" [attr.colspan]="gameService.activePlayersWithTotals().length">
                    <div class="scores-row">
                      @for (player of gameService.activePlayersWithTotals(); track player.id) {
                        <div 
                          class="score-cell"
                          [class.winner]="round.winnerId === player.id"
                          [class.not-editable]="!isEditableRound(round.id)"
                          (click)="startEdit(round.id, player.id)">
                          
                          @if (editingCell()?.roundId === round.id && editingCell()?.playerId === player.id) {
                            <input 
                              type="number"
                              class="edit-input"
                              [value]="getScore(round.id, player.id)"
                              (blur)="saveEdit($event)"
                              (keyup.enter)="saveEdit($event)"
                              (keyup.escape)="cancelEdit()"
                              #editInput
                              min="0"
                              autofocus>
                          } @else {
                            <span class="score-value">
                              {{ getScore(round.id, player.id) ?? '-' }}
                              @if (round.winnerId === player.id) {
                                <span class="winner-badge">🎉</span>
                              }
                            </span>
                          }
                        </div>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Add Score Button -->
        @if (!gameService.isGameOver()) {
          <div class="add-score-section">
            <button 
              class="btn-add-score" 
              (click)="submitScores()">
              Add Score
            </button>
          </div>
        }

        <!-- Error message -->
        @if (editError()) {
          <div class="edit-error">{{ editError() }}</div>
        }
      }
    </div>
  `,
  styles: [`
    /* Main container */
    .score-table-container {
      background: white;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    /* Empty state styling */
    .empty-state {
      text-align: center;
      padding: 40px 20px;
      color: #666;
    }

    .empty-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }

    .empty-state h3 {
      margin: 0 0 8px 0;
      color: #333;
    }

    .empty-state p {
      margin: 0;
      color: #999;
    }

    /* 
      SCROLLABLE TABLE WRAPPER
      FIXED height (not max-height) - always same size
      regardless of number of rounds
    */
    .table-wrapper {
      height: 280px;
      overflow-y: auto;
      overflow-x: auto;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
    }

    /* Main table */
    .score-table {
      width: 100%;
      border-collapse: collapse;
      min-width: 400px;
    }

    /* Purple gradient header row - STICKY */
    .header-row {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .header-row th {
      color: white;
      padding: 10px 8px;
      text-align: center;
      font-weight: 600;
      white-space: nowrap;
      font-size: 13px;
    }

    /* Fixed round number column */
    .round-col {
      width: 50px;
      background: rgba(0,0,0,0.1);
    }

    /* Container cell for all player headers */
    .players-header-cell {
      padding: 0 !important;
    }

    /* Flex container for draggable player columns */
    .players-drop-zone {
      display: flex;
      flex-direction: row;
    }

    /* Draggable player column headers */
    .player-col-header {
      min-width: 90px;
      padding: 10px 8px;
      cursor: grab;
      transition: background 0.2s;
      text-align: center;
      flex: 1;
    }

    .player-col-header:hover {
      background: rgba(255,255,255,0.1);
    }

    /* Red highlight for players who can't drop */
    .player-col-header.cannot-drop {
      background: rgba(244, 67, 54, 0.3);
    }

    .player-header {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }

    /* Drag handle indicator */
    .drag-handle {
      opacity: 0.6;
      font-size: 10px;
      cursor: grab;
    }

    .player-info {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1px;
    }

    .player-name {
      display: flex;
      align-items: center;
      gap: 2px;
      font-size: 12px;
      color: white;
      font-weight: 600;
    }

    .player-name.red {
      color: #ffcdd2;
    }

    /* Total score shown below name */
    .player-total {
      font-size: 11px;
      opacity: 0.9;
      font-weight: 500;
      color: white;
    }

    .warning-icon {
      cursor: help;
      font-size: 11px;
    }

    /* Placeholder shown during drag */
    .drag-placeholder {
      background: rgba(255,255,255,0.3);
      border: 2px dashed rgba(255,255,255,0.5);
      min-width: 90px;
      height: 50px;
      border-radius: 4px;
    }

    /* Preview element while dragging */
    .cdk-drag-preview {
      background: #667eea;
      color: white;
      padding: 10px 8px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      min-width: 90px;
    }

    .cdk-drag-preview .player-name,
    .cdk-drag-preview .player-total {
      color: white;
    }

    /* Animation when dropping */
    .cdk-drag-animating {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }

    /* Hide dragged item in original position */
    .cdk-drag-placeholder {
      opacity: 0;
    }

    /* Score rows */
    .score-row {
      border-bottom: 1px solid #e0e0e0;
    }

    .score-row:hover {
      background: #f5f7ff;
    }

    .score-row td {
      padding: 6px 8px;
      text-align: center;
      font-size: 13px;
    }

    /* Editable row (most recent) */
    .score-row.editable {
      background: #fafafa;
    }

    /* Container cell for scores */
    .scores-cell {
      padding: 0 !important;
    }

    /* Flex row for score cells */
    .scores-row {
      display: flex;
      flex-direction: row;
    }

    /* Clickable score cells */
    .score-cell {
      cursor: pointer;
      transition: background 0.2s;
      min-width: 90px;
      padding: 6px 8px;
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .score-cell:hover {
      background: #e8eaff;
    }

    /* Non-editable cells (older rounds) */
    .score-cell.not-editable {
      cursor: not-allowed;
      opacity: 0.8;
    }

    .score-cell.not-editable:hover {
      background: #fff3e0;
    }

    /* Green highlight for winner cells */
    .score-cell.winner {
      background: #e8f5e9;
    }

    .score-value {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }

    .winner-badge {
      font-size: 11px;
    }

    /* Inline edit input */
    .edit-input {
      width: 45px;
      padding: 3px 5px;
      border: 2px solid #667eea;
      border-radius: 4px;
      font-size: 12px;
      text-align: center;
    }

    .edit-input:focus {
      outline: none;
    }

    /* No rounds message */
    .no-rounds {
      text-align: center;
      padding: 16px;
      color: #999;
      font-style: italic;
      font-size: 13px;
    }

    /* Edit error message */
    .edit-error {
      margin-top: 8px;
      padding: 8px 12px;
      background: #ffebee;
      color: #c62828;
      border-radius: 6px;
      font-size: 12px;
      text-align: center;
    }

    /* Score input row */
    .input-row {
      background: #fafafa;
    }

    .score-input-cell {
      min-width: 90px;
      padding: 8px;
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .score-entry-input {
      width: 80px;
      padding: 8px;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      font-size: 14px;
      text-align: center;
    }

    .score-entry-input:focus {
      outline: none;
      border-color: #667eea;
    }

    /* Add Score button section */
    .add-score-section {
      display: flex;
      justify-content: center;
      margin-top: 16px;
    }

    .btn-add-score {
      padding: 10px 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-add-score:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }
  `]
})
export class ScoreTableComponent implements OnInit, AfterViewChecked {
  
  @Output() scoreEdited = new EventEmitter<{ roundId: number; playerId: string; newScore: number }>();
  @Output() scoresAdded = new EventEmitter<RoundScore[]>();

  @ViewChild('tableWrapper') tableWrapper!: ElementRef;

  gameService = inject(GameService);

  editingCell = signal<{ roundId: number; playerId: string } | null>(null);
  editError = signal('');
  scoreEntries = signal<ScoreEntry[]>([]);

  private lastRoundCount = 0;
  private lastPlayerCount = 0;

  ngOnInit(): void {
    this.initializeEntries();
  }

  ngDoCheck(): void {
    const activePlayers = this.gameService.activePlayersWithTotals();
    
    if (activePlayers.length !== this.lastPlayerCount) {
      this.initializeEntries();
      this.lastPlayerCount = activePlayers.length;
      return;
    }
    
    // Check if order changed
    const currentEntries = this.scoreEntries();
    if (currentEntries.length === activePlayers.length) {
      for (let i = 0; i < activePlayers.length; i++) {
        if (currentEntries[i]?.playerId !== activePlayers[i].id) {
          this.initializeEntries();
          return;
        }
      }
    }
  }

  ngAfterViewChecked(): void {
    const currentRoundCount = this.gameService.rounds().length;
    if (currentRoundCount > this.lastRoundCount && this.tableWrapper) {
      this.tableWrapper.nativeElement.scrollTop = this.tableWrapper.nativeElement.scrollHeight;
      this.lastRoundCount = currentRoundCount;
      // Clear entries after round is added
      this.initializeEntries();
    }
  }

  private initializeEntries(): void {
    const activePlayers = this.gameService.activePlayersWithTotals();
    this.scoreEntries.set(
      activePlayers.map(p => ({
        playerId: p.id,
        score: ''
      }))
    );
    this.lastPlayerCount = activePlayers.length;
  }

  submitScores(): void {
    const entries = this.scoreEntries();
    const activePlayers = this.gameService.activePlayersWithTotals();
    const scores: RoundScore[] = [];
    let winnerCount = 0;

    for (let i = 0; i < entries.length; i++) {
      const value = entries[i].score.trim();
      let score: number;
      
      if (value === '' || value === '0') {
        score = 0;
        winnerCount++;
      } else {
        score = parseInt(value, 10);
        if (isNaN(score) || score < 0) {
          this.editError.set('Please enter valid scores');
          setTimeout(() => this.editError.set(''), 3000);
          return;
        }
      }
      
      scores.push({ playerId: activePlayers[i].id, score });
    }

    if (winnerCount !== 1) {
      this.editError.set('Exactly one player must have 0 score (winner)');
      setTimeout(() => this.editError.set(''), 3000);
      return;
    }

    this.scoresAdded.emit(scores);
    this.initializeEntries();
  }

  // ==========================================================================
  // METHODS
  // ==========================================================================

  /**
   * Gets a player's score for a specific round.
   * 
   * @param roundId - Round number
   * @param playerId - Player ID
   * @returns Score value or null if not found
   */
  getScore(roundId: number, playerId: string): number | null {
    return this.gameService.getPlayerScore(roundId, playerId);
  }

  /**
   * Generates tooltip text for players who can't drop.
   * 
   * @param player - Player to generate tooltip for
   * @returns Tooltip string explaining the calculation
   */
  getCannotDropTooltip(player: PlayerWithTotal): string {
    const settings = this.gameService.settings();
    const afterDrop = player.totalScore + settings.dropPoints;
    return `Cannot drop! Current: ${player.totalScore} + Drop: ${settings.dropPoints} = ${afterDrop} > ${settings.maxPoints}`;
  }

  /**
   * Handles column drag-and-drop.
   * Reorders players based on new column positions.
   * This affects the dealer/open card rotation order!
   * 
   * @param event - CDK drag-drop event
   */
  onColumnDrop(event: CdkDragDrop<PlayerWithTotal[]>): void {
    // Skip if dropped in same position
    if (event.previousIndex === event.currentIndex) {
      return;
    }

    // Get current player order (make a copy to manipulate)
    const players = [...this.gameService.activePlayersWithTotals()];
    
    // CDK drag indices are 0-based for draggable items only (player columns)
    // No need to adjust for fixed columns (Round, Delete) as they're not part of cdkDrag
    moveItemInArray(players, event.previousIndex, event.currentIndex);
    
    // Update game service with new order
    const newOrder = players.map(p => p.id);
    this.gameService.reorderPlayers(newOrder);
  }

  /**
   * Checks if a round is the most recent one (only recent round can be edited).
   * 
   * @param roundId - Round ID to check
   * @returns True if this is the most recent round
   */
  isEditableRound(roundId: number): boolean {
    const mostRecentId = this.gameService.getMostRecentRoundId();
    return roundId === mostRecentId;
  }

  /**
   * Starts editing a cell.
   * Only allows editing the most recent round.
   * Shows the input field for that cell.
   * 
   * @param roundId - Round number
   * @param playerId - Player ID
   */
  startEdit(roundId: number, playerId: string): void {
    // Clear any previous error
    this.editError.set('');
    
    // Only allow editing the most recent round
    if (!this.isEditableRound(roundId)) {
      this.editError.set('Only the most recent round can be edited');
      setTimeout(() => this.editError.set(''), 3000);
      return;
    }
    
    this.editingCell.set({ roundId, playerId });
  }

  /**
   * Saves the edited score and exits edit mode.
   * Validates that only one player can have 0 score.
   * Emits scoreEdited event for parent to handle.
   * 
   * @param event - Blur or keyup event from input
   */
  saveEdit(event: Event): void {
    const input = event.target as HTMLInputElement;
    const newScore = parseInt(input.value, 10);
    const cell = this.editingCell();

    // Only save if valid number >= 0
    if (cell && !isNaN(newScore) && newScore >= 0) {
      // Check if this would create multiple winners
      if (this.gameService.wouldCreateMultipleWinners(cell.roundId, cell.playerId, newScore)) {
        this.editError.set('Only one player can have 0 score per round');
        setTimeout(() => this.editError.set(''), 3000);
        this.editingCell.set(null);
        return;
      }
      
      this.scoreEdited.emit({
        roundId: cell.roundId,
        playerId: cell.playerId,
        newScore
      });
    }

    this.editingCell.set(null);  // Exit edit mode
  }

  /**
   * Cancels editing without saving.
   * Called when user presses Escape.
   */
  cancelEdit(): void {
    this.editingCell.set(null);
    this.editError.set('');
  }
}
