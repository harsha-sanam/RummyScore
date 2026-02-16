/**
 * =============================================================================
 * CONFETTI SERVICE - Celebration animations for Rummy Score Tracker
 * =============================================================================
 * 
 * This service handles all celebration effects in the app:
 * 1. Round Win - When a player scores 0 (wins a hand)
 * 2. Game Win - When a player wins the entire game (last one standing)
 * 
 * Uses the 'canvas-confetti' library for particle effects.
 * Also displays toast notifications with the winner's name.
 */

import { Injectable } from '@angular/core';
import confetti from 'canvas-confetti';

@Injectable({
  providedIn: 'root'  // Singleton service available app-wide
})
export class ConfettiService {

  /**
   * Celebrates a round win with moderate confetti and a toast message.
   * Called when a player scores 0 in a round (they finished their cards first).
   * 
   * @param playerName - Name of the player who won the round
   * 
   * @example
   * confettiService.celebrateRoundWin('Alice');
   * // Shows confetti burst and toast: "🎉 Congratulations Alice! Round winner!"
   */
  celebrateRoundWin(playerName: string): void {
    // Medium-sized confetti burst from center-bottom
    confetti({
      particleCount: 100,    // Number of confetti pieces
      spread: 70,            // How wide the confetti spreads (degrees)
      origin: { y: 0.6 }     // Start from 60% down the screen
    });

    // Show congratulatory toast notification
    this.showToast(`🎉 Congratulations ${playerName}! Round winner!`);
  }

  /**
   * Celebrates a game win with extended confetti from both sides.
   * Called when only one player remains (they win the game).
   * 
   * Creates a 3-second continuous confetti animation from both
   * left and right sides of the screen.
   * 
   * @param playerName - Name of the player who won the game
   * 
   * @example
   * confettiService.celebrateGameWin('Bob');
   * // Shows 3 seconds of confetti and toast: "🏆 Bob WINS THE GAME! 🏆"
   */
  celebrateGameWin(playerName: string): void {
    // Duration of the celebration (3 seconds)
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    
    // Default confetti settings for game win
    const defaults = { 
      startVelocity: 30,     // Initial speed of particles
      spread: 360,           // Full circle spread
      ticks: 60,             // How long each particle lives
      zIndex: 10000          // Ensure confetti is on top
    };

    /**
     * Helper function to get random number in range.
     * Used to randomize confetti origin positions.
     */
    const randomInRange = (min: number, max: number) => {
      return Math.random() * (max - min) + min;
    };

    // Create interval that fires confetti every 250ms
    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      // Stop when duration is complete
      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }

      // Reduce particle count as time progresses (fade out effect)
      const particleCount = 50 * (timeLeft / duration);

      // Fire confetti from LEFT side (x: 0.1 to 0.3)
      confetti({
        ...defaults,
        particleCount,
        origin: { 
          x: randomInRange(0.1, 0.3),  // Left third of screen
          y: Math.random() - 0.2        // Slightly above top
        }
      });
      
      // Fire confetti from RIGHT side (x: 0.7 to 0.9)
      confetti({
        ...defaults,
        particleCount,
        origin: { 
          x: randomInRange(0.7, 0.9),  // Right third of screen
          y: Math.random() - 0.2        // Slightly above top
        }
      });
    }, 250);  // Fire every 250ms

    // Show big celebratory toast
    this.showToast(`🏆 ${playerName} WINS THE GAME! 🏆`, true);
  }

  /**
   * Displays a toast notification on screen.
   * Toast automatically fades in, stays visible, then fades out.
   * 
   * @param message - Text to display in the toast
   * @param isGameWin - If true, uses larger/gold styling for game win
   */
  private showToast(message: string, isGameWin: boolean = false): void {
    // Create toast DOM element
    const toast = document.createElement('div');
    toast.className = `confetti-toast ${isGameWin ? 'game-win' : 'round-win'}`;
    toast.textContent = message;
    
    // Apply inline styles for the toast
    Object.assign(toast.style, {
      position: 'fixed',
      top: '20%',                                           // Position near top
      left: '50%',
      transform: 'translateX(-50%)',                        // Center horizontally
      padding: isGameWin ? '24px 48px' : '16px 32px',      // Larger for game win
      backgroundColor: isGameWin ? '#ffd700' : '#4caf50',  // Gold vs green
      color: isGameWin ? '#000' : '#fff',                  // Black vs white text
      borderRadius: '12px',
      fontSize: isGameWin ? '28px' : '18px',               // Larger for game win
      fontWeight: 'bold',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      zIndex: '10001',                                      // Above confetti
      animation: 'fadeInOut 3s ease-in-out forwards',
      textAlign: 'center'
    });

    // Add CSS animation keyframes if not already added
    if (!document.getElementById('confetti-toast-styles')) {
      const style = document.createElement('style');
      style.id = 'confetti-toast-styles';
      style.textContent = `
        @keyframes fadeInOut {
          0% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
          15% { opacity: 1; transform: translateX(-50%) translateY(0); }
          85% { opacity: 1; transform: translateX(-50%) translateY(0); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
        }
      `;
      document.head.appendChild(style);
    }

    // Add toast to page
    document.body.appendChild(toast);

    // Remove toast after animation completes (3 seconds)
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }
}
