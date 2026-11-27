/** Presse-papiers, partage du téléphone, téléchargement. */

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Ancien navigateur, ou page non sécurisée.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export const canShareFiles = (f: File) => typeof navigator.canShare === 'function' && navigator.canShare({ files: [f] });

/** Feuille de partage du téléphone ; false si elle n'existe pas (ordinateur) ou a été refermée. */
export async function shareNative(data: ShareData): Promise<boolean> {
  if (typeof navigator.share !== 'function') return false;
  try {
    await navigator.share(data);
    return true;
  } catch {
    return false;
  }
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
