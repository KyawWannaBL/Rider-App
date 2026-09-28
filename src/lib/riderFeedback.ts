export type RiderFeedbackTone = "dispatch" | "success" | "warning" | "error" | "cash";

const toneMap: Record<RiderFeedbackTone, { frequency: number; endFrequency: number; duration: number; type: OscillatorType }> = {
  dispatch: { frequency: 740, endFrequency: 980, duration: 0.22, type: "sine" },
  success: { frequency: 660, endFrequency: 990, duration: 0.18, type: "sine" },
  warning: { frequency: 520, endFrequency: 390, duration: 0.24, type: "triangle" },
  error: { frequency: 330, endFrequency: 220, duration: 0.28, type: "sawtooth" },
  cash: { frequency: 880, endFrequency: 1320, duration: 0.2, type: "sine" },
};

export function playRiderFeedback(type: RiderFeedbackTone) {
  if (typeof window === "undefined") return;

  try {
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) return;

    const context = new AudioContextCtor();
    const gain = context.createGain();
    const oscillator = context.createOscillator();
    const config = toneMap[type];

    oscillator.type = config.type;
    oscillator.frequency.setValueAtTime(config.frequency, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(80, config.endFrequency),
      context.currentTime + config.duration,
    );

    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.07, context.currentTime + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + config.duration);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + config.duration);

    window.setTimeout(() => void context.close(), Math.ceil((config.duration + 0.08) * 1000));
  } catch {
    // Sound feedback is best-effort and must never block field operations.
  }
}

export function vibrateRider(pattern: number | number[] = 18) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // Haptics are best-effort.
  }
}

export function riderFeedback(type: RiderFeedbackTone) {
  playRiderFeedback(type);
  vibrateRider(type === "error" ? [35, 25, 35] : type === "warning" ? [24, 18, 24] : 18);
}
