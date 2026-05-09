export async function copyText(text: string): Promise<boolean> {
  if (copyViaTextarea(text)) return true;

  try {
    window.focus();
    if (navigator.clipboard?.writeText) {
      const copied = await Promise.race([
        navigator.clipboard.writeText(text).then(() => true).catch(() => false),
        new Promise<boolean>((resolve) => window.setTimeout(() => resolve(false), 650))
      ]);
      if (copied) return true;
    }
  } catch {
    // Fall through to the textarea path for browsers that require focused inputs.
  }

  return copyViaTextarea(text);
}

function copyViaTextarea(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.inset = "0 auto auto 0";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}
