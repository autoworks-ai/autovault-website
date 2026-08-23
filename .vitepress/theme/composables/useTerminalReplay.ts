import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { prefersReducedMotion } from "../utils/motion";

export type TerminalLineType = "cmd" | "out" | "ok" | "err" | "blank";

export interface TerminalReplayLine {
  type: TerminalLineType;
  text?: string;
}

export interface TerminalReplayOptions {
  autoStart?: boolean;
  getDelay?: (line: TerminalReplayLine) => number;
  scrollTarget?: () => HTMLElement | null;
}

export function getTerminalLineDelay(line: TerminalReplayLine): number {
  if (line.type === "cmd") return 700;
  if (line.type === "ok") return 250;
  return 130;
}

function hasReducedMotion() {
  return prefersReducedMotion();
}

export function useTerminalReplay(lines: readonly TerminalReplayLine[], options: TerminalReplayOptions = {}) {
  const shown = ref(0);
  const running = ref(false);
  const reducedMotion = ref(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  const visibleLines = computed(() => lines.slice(0, shown.value));
  const complete = computed(() => shown.value >= lines.length);

  function clearTimer() {
    if (timer) clearTimeout(timer);
    timer = undefined;
  }

  async function scrollToBottom() {
    await nextTick();
    const target = options.scrollTarget?.();
    if (target) target.scrollTop = target.scrollHeight;
  }

  function finishForReducedMotion() {
    shown.value = lines.length;
    running.value = false;
    clearTimer();
    void scrollToBottom();
  }

  function schedule() {
    clearTimer();
    if (reducedMotion.value) {
      finishForReducedMotion();
      return;
    }
    if (!running.value || complete.value) {
      running.value = false;
      return;
    }

    const line = lines[shown.value];
    const delay = options.getDelay?.(line) ?? getTerminalLineDelay(line);
    timer = setTimeout(() => {
      shown.value += 1;
      void scrollToBottom();
      schedule();
    }, delay);
  }

  function start() {
    if (complete.value || reducedMotion.value) {
      finishForReducedMotion();
      return;
    }
    running.value = true;
    schedule();
  }

  function replay() {
    shown.value = 0;
    if (reducedMotion.value) {
      finishForReducedMotion();
      return;
    }
    running.value = true;
    void scrollToBottom();
    schedule();
  }

  function pause() {
    running.value = false;
    clearTimer();
  }

  function resume() {
    if (complete.value) return;
    start();
  }

  onMounted(() => {
    reducedMotion.value = hasReducedMotion();
    if (reducedMotion.value) {
      finishForReducedMotion();
      return;
    }
    if (options.autoStart !== false) start();
  });

  onBeforeUnmount(clearTimer);

  return {
    shown,
    visibleLines,
    complete,
    running,
    reducedMotion,
    replay,
    pause,
    resume
  };
}
