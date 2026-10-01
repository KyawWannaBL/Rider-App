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


const GLOBAL_FEEDBACK_ATTR = "data-britium-feedback-observed";
let globalFeedbackInstalled = false;
let lastGlobalFeedbackKey = "";
let lastGlobalFeedbackAt = 0;

function inferFeedbackTone(text: string): RiderFeedbackTone {
  const value = String(text || "").toLowerCase();

  if (/cod|cash|mmk|ငွေ|ကောက်ခံ|လွှဲငွေ/.test(value)) return "cash";
  if (/error|failed|fail|denied|invalid|unable|expired|မအောင်မြင်|အမှား|မရပါ|ငြင်းပယ်/.test(value)) return "error";
  if (/warning|pending|wait|required|missing|attention|သတိ|စောင့်|လိုအပ်/.test(value)) return "warning";
  if (/success|completed|saved|uploaded|verified|delivered|confirmed|approved|အောင်မြင်|ပြီးပါပြီ|သိမ်းဆည်း|အတည်ပြု/.test(value)) return "success";
  return "dispatch";
}

function visibleFeedbackText(node: Element): string {
  if (!(node instanceof HTMLElement)) return "";
  const style = window.getComputedStyle(node);
  if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity || "1") === 0) return "";
  return String(node.innerText || node.textContent || "").replace(/\s+/g, " ").trim();
}

function shouldAnnounceNode(node: Element): boolean {
  if (!(node instanceof HTMLElement)) return false;
  if (node.hasAttribute(GLOBAL_FEEDBACK_ATTR)) return false;

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
  node.setAttribute(GLOBAL_FEEDBACK_ATTR, "true");

  const text = visibleFeedbackText(node);
  if (!text || text.length < 2) return;

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

  const scan = (root: ParentNode) => {
    if (root instanceof Element) announceFeedbackNode(root);
    root.querySelectorAll?.(
      '[role="alert"],[role="status"],[aria-live="assertive"],[aria-live="polite"],[data-sonner-toast],.toast,.notification,.alert,.message,.notice'
    ).forEach((node) => announceFeedbackNode(node));
  };

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof Element) scan(node);
      });

      if (mutation.type === "characterData" && mutation.target.parentElement) {
        announceFeedbackNode(mutation.target.parentElement);
      }
    }
  });

  const start = () => {
    scan(document);
    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
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
