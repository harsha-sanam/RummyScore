/**
 * =============================================================================
 * SCORE TABLE COMPONENT - Clean UI
 * =============================================================================
 * 
 * Displays player names with totals and score input fields.
 * Clean, minimal design matching the reference screenshot.
 */

import { Component, inject, signal, EventEmitter, Output, ElementRef, ViewChild, AfterViewChecked, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { GameService } from '../../services/game.service';
import { PlayerWithTotal, RoundScore } from '../../models/game.model';

interface ScoreEntry {
  playerId: string;
  playerName: string;
  score: string;  // String to allow empty input
  isDropped: boolean;
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
          <p>Add players to start tracking scores</p>
        </div>
      } @else {
        
        <!-- Player headers with scores - draggable -->
        <div 
          class="player-headers"
          cdkDropList 
          cdkDropListOrientation="horizontal"
          (cdkDropListDropped)="onColumnDrop($event)">
          
          @for (player of gameService.activePlayersWithTotals(); track player.id; let i = $index) {
            <div 
              cdkDrag
              class="player-column"
              [class.cannot-drop]="!player.canDrop">
              
              <div class="player-header" cdkDragHandle>
                <span class="player-name" [class.red]="!player.canDrop">
                  {{ player.name }}
                </span>
                <span class="player-total">({{ player.totalScore }})</span>
              </div>
              
              <!-- Score input for this player -->
              <div class="score-input-wrapper">
                <input 
                  type="text"
                  class="score-input"
                  [(ngModel)]="scoreEntries()[i].score"
                  (ngModelChange)="onScoreChange(i)"
                  [disabled]="scoreEntries()[i].isDropped"
                  [class.dropped]="scoreEntries()[i].isDropped"
                  placeholder="">
                
                <!-- Drag handle indicator -->
                <span class="drag-indicator">⋮</span>
              </div>
              
              <!-- Placeholder shown while dragging -->
              <div *cdkDragPlaceholder class="drag-placeholder"></div>
            </div>
          }
        </div>

        <!-- Error message -->
        @if (errorMessage()) {
          <div class="error-message">{{ errorMessage() }}</div>
        }
      }
    </div>
  `,
  styles: [`
    /* Main container - clean white background */
    .score-table-container {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      padding: 16px;
    }

    /* Empty state styling */
    .empty-state {
      text-align: center;
      padding: 40px 20px;
    }

    .empty-state p {
      margin: 0;
      font-size: 16px;
      color: #999;
    }

    /* Player headers row - horizontal flex */
    .player-headers {
      display: flex;
      flex-direction: row;
      gap: 12px;
    }

    /* Individual player column */
    .player-column {
      flex: 1;
      text-align: center;
      cursor: grab;
      min-width: 100px;
    }

    .player-column:active {
      cursor: grabbing;
    }

    .player-header {
      margin-bottom: 12px;
      padding: 4px;
    }

    .player-name {
      display: block;
      font-size: 20px;
      font-weight: 500;
      color: #333;
    }

    .player-name.red {
      color: #e53935;
    }

    .player-total {
      display: block;
      font-size: 18px;
      color: #333;
      font-weight: 400;
    }

    /* Score input wrapper */
    .score-input-wrapper {
      position: relative;
    }

    .score-input {
      width: 100%;
      padding: 14px 12px;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      font-size: 18px;
      text-align: center;
      box-sizing: border-box;
      background: white;
    }

    .score-input:focus {
      outline: none;
      border-color: #4a7c59;
    }

    .score-input.dropped {
      background: #fff3e0;
      border-color: #ff9800;
    }

    .score-input:disabled {
      background: #fff3e0;
      color: #e65100;
    }

    /* Drag indicator */
    .drag-indicator {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      color: #bdbdbd;
      font-size: 16px;
      pointer-events: none;
    }

    /* Placeholder shown during drag */
    .drag-placeholder {
      background: #f5f5f5;
      border: 2px dashed #bdbdbd;
      min-width: 100px;
      height: 100px;
      border-radius: 4px;
    }

    /* Preview element while dragging */
    .cdk-drag-preview {
      background: white;
      padding: 12px;
      border-radius: 4px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.2);
      text-align: center;
    }

    .cdk-drag-preview .player-name {
      font-size: 18px;
      color: #333;
    }

    .cdk-drag-preview .player-total {
      font-size: 16px;
      color: #666;
    }

    /* Animation when dropping */
    .cdk-drag-animating {
      transition: transform 200ms ease-out;
    }

    /* Hide dragged item in original position */
    .cdk-drag-placeholder {
      opacity: 0;
    }

    /* Error message */
    .error-message {
      margin-top: 12px;
      padding: 10px 16px;
      background: #ffebee;
      color: #c62828;
      border-radius: 4px;
      font-size: 14px;
      text-align: center;
    }
  `]
})
export class ScoreTableComponent implements OnInit, AfterViewChecked {
  
  @Output() scoreEdited = new EventEmitter<{ roundId: number; playerId: string; newScore: number }>();
  @Output() scoresSubmitted = new EventEmitter<RoundScore[]>();

  @ViewChild('tableWrapper') tableWrapper!: ElementRef;

  gameService = inject(GameService);

  scoreEntries = signal<ScoreEntry[]>([]);
  errorMessage = signal('');
  
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
    if (currentRoundCount > this.lastRoundCount) {
      this.lastRoundCount = currentRoundCount;
      // Clear entries after a round is added
      this.initializeEntries();
    }
  }

  private initializeEntries(): void {
    const activePlayers = this.gameService.activePlayersWithTotals();
    this.scoreEntries.set(
      activePlayers.map(p => ({
        playerId: p.id,
        playerName: p.name,
        score: '',
        isDropped: false
      }))
    );
    this.lastPlayerCount = activePlayers.length;
  }

  onScoreChange(index: number): void {
    const entries = this.scoreEntries();
    if (entries[index]) {
      entries[index].isDropped = false;
    }
    this.errorMessage.set('');
  }

  onColumnDrop(event: CdkDragDrop<PlayerWithTotal[]>): void {
    if (event.previousIndex === event.currentIndex) {
      return;
    }

    const players = [...this.gameService.activePlayersWithTotals()];
    moveItemInArray(players, event.previousIndex, event.currentIndex);
    
    const newOrder = players.map(p => p.id);
    this.gameService.reorderPlayers(newOrder);
  }

  /**
   * Gets scores for submission - called by inline-score-entry
   */
  getScores(): RoundScore[] | null {
    const entries = this.scoreEntries();
    const scores: RoundScore[] = [];
    let winnerCount = 0;

    for (const entry of entries) {
      let score: number;
      
      if (entry.score === '' || entry.score === '0') {
        score = 0;
        winnerCount++;
      } else {
        score = parseInt(entry.score, 10);
        if (isNaN(score) || score < 0) {
          this.errorMessage.set('Please enter valid scores');
          return null;
        }
      }
      
      scores.push({ playerId: entry.playerId, score });
    }

    if (winnerCount !== 1) {
      this.errorMessage.set('Exactly one player must have 0 score (winner)');
      return null;
    }

    return scores;
  }

  clearEntries(): void {
    this.initializeEntries();
    this.errorMessage.set('');
  }
}
