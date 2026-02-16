/**
 * =============================================================================
 * INLINE SCORE ENTRY COMPONENT - Clean UI
 * =============================================================================
 * 
 * Simple "Add Score" button that works with the score table component.
 */

import { Component, inject, signal, EventEmitter, Output, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GameService } from '../../services/game.service';
import { RoundScore } from '../../models/game.model';
import { ScoreTableComponent } from '../score-table/score-table.component';

interface ScoreEntry {
  playerId: string;
  playerName: string;
  score: string;
  isDropped: boolean;
}

@Component({
  selector: 'app-inline-score-entry',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="score-entry-container">
      <button 
        class="btn-submit" 
        (click)="submitScores()">
        Add Score
      </button>
    </div>
  `,
  styles: [`
    .score-entry-container {
      display: flex;
      justify-content: center;
      padding: 8px 0;
    }

    .btn-submit {
      padding: 12px 32px;
      background: #1976d2;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }

    .btn-submit:hover {
      background: #1565c0;
    }
  `]
})
export class InlineScoreEntryComponent implements OnInit {
  
  @Output() scoresAdded = new EventEmitter<RoundScore[]>();

  gameService = inject(GameService);

  scoreEntries = signal<ScoreEntry[]>([]);
  validationMessage = signal('');
  private lastPlayerCount = 0;

  ngOnInit(): void {
    this.initializeEntries();
  }

  ngDoCheck(): void {
    const activePlayers = this.gameService.activePlayersWithTotals();
    
    if (activePlayers.length !== this.lastPlayerCount) {
      this.initializeEntries();
      this.lastPlayerCount = activePlayers.length;
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

  isWinner(entry: ScoreEntry): boolean {
    return !entry.isDropped && (entry.score === '' || entry.score === '0');
  }

  isValid(): boolean {
    const entries = this.scoreEntries();
    const winners = entries.filter(e => this.isWinner(e));
    return winners.length === 1;
  }

  submitScores(): void {
    // Get scores from the score table inputs via DOM
    const inputs = document.querySelectorAll('.score-input') as NodeListOf<HTMLInputElement>;
    const activePlayers = this.gameService.activePlayersWithTotals();
    
    if (inputs.length !== activePlayers.length) {
      return;
    }

    const scores: RoundScore[] = [];
    let winnerCount = 0;

    for (let i = 0; i < activePlayers.length; i++) {
      const value = inputs[i].value.trim();
      let score: number;
      
      if (value === '' || value === '0') {
        score = 0;
        winnerCount++;
      } else {
        score = parseInt(value, 10);
        if (isNaN(score) || score < 0) {
          alert('Please enter valid scores');
          return;
        }
      }
      
      scores.push({ playerId: activePlayers[i].id, score });
    }

    if (winnerCount !== 1) {
      alert('Exactly one player must have 0 score (winner)');
      return;
    }

    this.scoresAdded.emit(scores);
    
    // Clear inputs
    inputs.forEach(input => input.value = '');
  }
}
