/**
 * =============================================================================
 * GAME SETUP MODAL COMPONENT
 * =============================================================================
 * 
 * This modal appears when the app first loads (or after a full reset).
 * It collects the initial game settings from the user:
 * 
 * 1. Total Game Points - The point limit (101, 201, 251, 501, or custom)
 *    When a player exceeds this, they're "out" of the game.
 * 
 * 2. Drop Points - Penalty for dropping a round early
 *    Default: MAX(20, 10% of total points)
 *    This is also used to determine if a player can rejoin.
 * 
 * The modal cannot be dismissed without completing setup.
 */

import { Component, EventEmitter, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { calculateDropPoints } from '../../models/game.model';

@Component({
  selector: 'app-game-setup-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- 
      Modal Overlay - Dark semi-transparent background
      Covers entire screen and centers the modal content
    -->
    <div class="modal-overlay">
      <div class="modal-content">
        
        <!-- Header with welcome message -->
        <div class="modal-header">
          <h2>🎴 Welcome to Rummy Score Tracker</h2>
          <p>Set up your game to get started</p>
        </div>

        <div class="modal-body">
          
          <!-- 
            MAX POINTS SELECTION
            User can click preset buttons or enter custom value
          -->
          <div class="form-group">
            <label for="maxPoints">Total Game Points</label>
            
            <!-- Preset buttons for common point values -->
            <div class="preset-buttons">
              <button 
                type="button"
                [class.active]="maxPoints() === 101"
                (click)="setMaxPoints(101)">
                101
              </button>
              <button 
                type="button"
                [class.active]="maxPoints() === 201"
                (click)="setMaxPoints(201)">
                201
              </button>
              <button 
                type="button"
                [class.active]="maxPoints() === 251"
                (click)="setMaxPoints(251)">
                251
              </button>
              <button 
                type="button"
                [class.active]="maxPoints() === 501"
                (click)="setMaxPoints(501)">
                501
              </button>
            </div>
            
            <!-- Custom value input -->
            <input 
              type="number" 
              id="maxPoints"
              [(ngModel)]="customMaxPoints"
              (ngModelChange)="onCustomMaxPointsChange($event)"
              placeholder="Or enter custom points"
              min="50"
              max="1000">
          </div>

          <!-- 
            DROP POINTS INPUT
            Shows suggested value based on max points
            User can override if desired
          -->
          <div class="form-group">
            <label for="dropPoints">
              Drop Points
              <span class="hint">(Default: max of 20 or 10% of total)</span>
            </label>
            <input 
              type="number" 
              id="dropPoints"
              [(ngModel)]="dropPointsValue"
              min="5"
              max="100">
            <p class="calculated-hint">
              Suggested: {{ suggestedDropPoints() }} points
            </p>
          </div>

          <!-- Summary of selected settings -->
          <div class="summary">
            <p><strong>Game Summary:</strong></p>
            <p>• Max Points: {{ maxPoints() }}</p>
            <p>• Drop Points: {{ dropPointsValue }}</p>
            <p>• A player is "out" when they exceed {{ maxPoints() }} points</p>
          </div>
        </div>

        <!-- Footer with start button -->
        <div class="modal-footer">
          <button 
            class="btn-primary"
            [disabled]="!isValid()"
            (click)="startGame()">
            Start Game 🎯
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* Dark overlay covering entire screen */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      backdrop-filter: blur(4px);
    }

    /* White modal card */
    .modal-content {
      background: white;
      border-radius: 16px;
      width: 90%;
      max-width: 480px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      overflow: hidden;
    }

    /* Purple gradient header */
    .modal-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 24px;
      text-align: center;
    }

    .modal-header h2 {
      margin: 0 0 8px 0;
      font-size: 24px;
    }

    .modal-header p {
      margin: 0;
      opacity: 0.9;
    }

    .modal-body {
      padding: 24px;
    }

    .form-group {
      margin-bottom: 24px;
    }

    .form-group label {
      display: block;
      font-weight: 600;
      margin-bottom: 8px;
      color: #333;
    }

    .form-group .hint {
      font-weight: normal;
      font-size: 12px;
      color: #666;
    }

    /* Row of preset point buttons */
    .preset-buttons {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }

    .preset-buttons button {
      flex: 1;
      padding: 12px;
      border: 2px solid #e0e0e0;
      background: white;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .preset-buttons button:hover {
      border-color: #667eea;
      background: #f5f7ff;
    }

    /* Active/selected preset button */
    .preset-buttons button.active {
      border-color: #667eea;
      background: #667eea;
      color: white;
    }

    input[type="number"] {
      width: 100%;
      padding: 12px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      font-size: 16px;
      box-sizing: border-box;
      transition: border-color 0.2s;
    }

    input[type="number"]:focus {
      outline: none;
      border-color: #667eea;
    }

    .calculated-hint {
      margin: 8px 0 0 0;
      font-size: 13px;
      color: #666;
    }

    /* Gray summary box */
    .summary {
      background: #f8f9fa;
      padding: 16px;
      border-radius: 8px;
      font-size: 14px;
    }

    .summary p {
      margin: 4px 0;
    }

    .modal-footer {
      padding: 16px 24px 24px;
    }

    /* Full-width gradient button */
    .btn-primary {
      width: 100%;
      padding: 16px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 18px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .btn-primary:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `]
})
export class GameSetupModalComponent {
  
  /**
   * Event emitted when user clicks "Start Game".
   * Parent component listens to this to initialize the game.
   */
  @Output() gameStarted = new EventEmitter<{ maxPoints: number; dropPoints: number }>();

  // ==========================================================================
  // COMPONENT STATE
  // ==========================================================================

  /** Currently selected max points (signal for reactivity) */
  maxPoints = signal(201);
  
  /** Custom max points input value (null if using preset) */
  customMaxPoints: number | null = null;
  
  /** Current drop points value */
  dropPointsValue = 20;

  /** Calculated suggested drop points based on max points */
  suggestedDropPoints = signal(20);

  // ==========================================================================
  // METHODS
  // ==========================================================================

  /**
   * Sets max points to a preset value.
   * Clears custom input and updates suggested drop points.
   * 
   * @param value - Preset value (101, 201, 251, or 501)
   */
  setMaxPoints(value: number): void {
    this.maxPoints.set(value);
    this.customMaxPoints = null;  // Clear custom input
    this.updateSuggestedDropPoints();
  }

  /**
   * Handles changes to the custom max points input.
   * Updates max points if value is valid (>= 50).
   * 
   * @param value - New custom value from input
   */
  onCustomMaxPointsChange(value: number): void {
    if (value && value >= 50) {
      this.maxPoints.set(value);
      this.updateSuggestedDropPoints();
    }
  }

  /**
   * Recalculates suggested drop points based on current max points.
   * Formula: MAX(20, 10% of maxPoints)
   * Also updates the drop points input to the suggested value.
   */
  private updateSuggestedDropPoints(): void {
    const suggested = calculateDropPoints(this.maxPoints());
    this.suggestedDropPoints.set(suggested);
    this.dropPointsValue = suggested;  // Auto-fill with suggested value
  }

  /**
   * Validates that all inputs are acceptable.
   * 
   * @returns True if form is valid and can be submitted
   */
  isValid(): boolean {
    return this.maxPoints() >= 50 && this.dropPointsValue >= 5;
  }

  /**
   * Emits the gameStarted event with current settings.
   * Called when user clicks "Start Game" button.
   */
  startGame(): void {
    if (this.isValid()) {
      this.gameStarted.emit({
        maxPoints: this.maxPoints(),
        dropPoints: this.dropPointsValue
      });
    }
  }
}
