export type RiderFeedbackTone = "dispatch" | "success" | "warning" | "error" | "cash";

const toneMap: Record<RiderFeedbackTone, { frequency: number; endFrequency: number; duration: number; type: OscillatorType }> = {
  dispatch: { frequency: 740, endFrequency: 980, duration: 0.22, type: "sine" },
  success: { frequency: 660, endFrequency: 990, duration: 0.18, type: "sine" },
  warning: { frequency: 520, endFrequency: 390, duration: 0.24, type: "triangle" },
  error: { frequency: 330, endFrequency: 220, duration: 0.28, type: "sawtooth" },
  cash: { frequency: 880, endFrequency: 1320, duration: 0.2, type: "sine" },
};

let sharedAudioContext: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextCtor) return null;
  if (!sharedAudioContext || sharedAudioContext.state === "closed") {
    sharedAudioContext = new AudioContextCtor();
  }
  return sharedAudioContext;
}

export async function unlockRiderNotificationAudio() {
  try {
    const context = getAudioContext();
    if (!context) return;
    if (context.state === "suspended") await context.resume();
  } catch {
    // Best-effort only.
  }
}

export async function playRiderFeedback(type: RiderFeedbackTone) {
  if (typeof window === "undefined") return;

  try {
    const context = getAudioContext();
    if (!context) return;
    if (context.state === "suspended") await context.resume();
    if (context.state !== "running") return;

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
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start();
    oscillator.stop(context.currentTime + config.duration);

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


const observedFeedbackText = new WeakMap<Element, string>();
const FEEDBACK_SELECTOR = '[role="alert"],[role="status"],[aria-live="assertive"],[aria-live="polite"],[data-sonner-toast],.toast,.notification,.alert,.message,.notice';
let globalFeedbackInstalled = false;
let lastGlobalFeedbackKey = "";
let lastGlobalFeedbackAt = 0;

function inferFeedbackTone(text: string): RiderFeedbackTone {
  const value = String(text || "").toLowerCase();

  if (/error|failed|fail|denied|invalid|unable|expired|မအောင်မြင်|အမှား|မရပါ|ငြင်းပယ်/.test(value)) return "error";
  if (/warning|pending|wait|required|missing|attention|သတိ|စောင့်|လိုအပ်/.test(value)) return "warning";
  if (/cod|cash|mmk|ငွေ|ကောက်ခံ|လွှဲငွေ/.test(value)) return "cash";
  if (/success|completed|saved|uploaded|verified|delivered|confirmed|approved|အောင်မြင်|ပြီးပါပြီ|သိမ်းဆည်း|အတည်ပြု/.test(value)) return "success";
  return "dispatch";
}

function visibleFeedbackText(node: Element): string {
  if (!(node instanceof HTMLElement)) return "";
  for (let current: HTMLElement | null = node; current instanceof HTMLElement; current = current.parentElement) {
    const style = window.getComputedStyle(current);
    if (current.hidden || current.getAttribute("aria-hidden") === "true" || style.display === "none" || style.visibility === "hidden" || Number(style.opacity || "1") === 0) return "";
  }
  return String(node.innerText || node.textContent || "").replace(/\s+/g, " ").trim();
}

function shouldAnnounceNode(node: Element): boolean {
  if (!(node instanceof HTMLElement)) return false;

  const role = String(node.getAttribute("role") || "").toLowerCase();
  const live = String(node.getAttribute("aria-live") || "").toLowerCase();
  const classes = String(node.className || "").toLowerCase();
  const testId = String(node.getAttribute("data-sonner-toast") || node.getAttribute("data-radix-toast-viewport") || "");

  return (
    role === "alert" ||
    role === "status" ||
    live === "assertive" ||
    live === "polite" ||
    Boolean(testId) ||
    /toast|notification|alert|message|notice/.test(classes)
  );
}

function announceFeedbackNode(node: Element) {
  if (!shouldAnnounceNode(node)) return;
  // Toast stacks expose a live region as well as individual toast alerts.
  // Announce the individual messages, not the aggregate container text.
  if (Array.from(node.querySelectorAll(FEEDBACK_SELECTOR)).some(shouldAnnounceNode)) return;

  const text = visibleFeedbackText(node);
  if (!text || text.length < 2) {
    observedFeedbackText.delete(node);
    return;
  }
  if (observedFeedbackText.get(node) === text) return;
  observedFeedbackText.set(node, text);

  const key = text.slice(0, 180).toLowerCase();
  const now = Date.now();
  if (key === lastGlobalFeedbackKey && now - lastGlobalFeedbackAt < 1800) return;

  lastGlobalFeedbackKey = key;
  lastGlobalFeedbackAt = now;
  riderFeedback(inferFeedbackTone(text));
}

export function installGlobalRiderNotificationFeedback() {
  if (globalFeedbackInstalled || typeof window === "undefined" || typeof document === "undefined") return;
  globalFeedbackInstalled = true;

  const unlock = () => { void unlockRiderNotificationAudio(); };
  // Retry on later gestures if Android suspended audio while the app was away.
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("touchstart", unlock, { passive: true });
  window.addEventListener("keydown", unlock);

  const scan = (root: ParentNode) => {
    if (root instanceof Element) announceFeedbackNode(root);
    root.querySelectorAll?.(FEEDBACK_SELECTOR).forEach((node) => announceFeedbackNode(node));
  };

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof Element) scan(node);
      });

      // React often changes text inside an existing live region rather than
      // inserting another alert element. Follow the mutation to that region.
      const target = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
      const feedbackNode = target?.closest(FEEDBACK_SELECTOR);
      if (feedbackNode) announceFeedbackNode(feedbackNode);
      if (mutation.type === "attributes" && target) scan(target);
    }
  });

  const start = () => {
    scan(document);
    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["hidden", "class", "style", "role", "aria-live", "aria-hidden", "data-state"],
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  const originalAlert = window.alert.bind(window);
  window.alert = (message?: any) => {
    riderFeedback(inferFeedbackTone(String(message || "")));
    originalAlert(message);
  };

  const originalConfirm = window.confirm.bind(window);
  window.confirm = (message?: string) => {
    riderFeedback("warning");
    return originalConfirm(message);
  };
}
