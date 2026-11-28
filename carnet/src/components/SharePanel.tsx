/** Envoyer une main : WhatsApp, texte, lien (la main est dans le lien), image. */
import { useState } from 'react';
import { canShareFiles, copyText, download, shareNative } from '../lib/device';
import { decisionPoints, type HandData } from '../lib/hand';
import { handImage } from '../lib/image';
import { encodeHand, handLink, handText, whatsappUrl } from '../lib/share';
import { Icon, useAction, useToast } from './ui';

export function SharePanel({ hand, link: fixedLink, title = 'Partager la main' }: { hand: HandData; link?: string; title?: string }) {
  const toast = useToast();
  const [run, busy] = useAction();
  const asked = decisionPoints(hand).length;
  const question = asked > 0;
  const [all, setAll] = useState(!question);
  const link = async () => fixedLink ?? handLink(await encodeHand({ ...hand }));
  const text = async () => handText(hand, { all, link: await link() });

  return (
    <section className="card stack sm">
      <h2>{title}</h2>
      {question && (
        <label className="switch">
          <input type="checkbox" checked={!all} onChange={e => setAll(!e.target.checked)} />
          <span className="track" />
          <span className="switch-text">{asked > 1 ? 'S\'arrêter à la première question' : 'S\'arrêter à la question'}<small>{asked > 1
            ? `Le texte et l'image posent la première question sans dévoiler la suite. Le lien pose les ${asked} questions l'une après l'autre.`
            : 'Le texte et l\'image posent la question « Et toi, tu fais quoi ? » sans dévoiler la suite. Le lien la montre après réponse.'}</small></span>
        </label>
      )}
      <div className="sharegrid">
        <button className="btn primary" disabled={busy} onClick={() => run(async () => {
          const t = await text();
          window.open(whatsappUrl(t), '_blank', 'noopener');
        })}><Icon name="chat" />WhatsApp</button>
        <button className="btn" disabled={busy} onClick={() => run(async () => {
          if (await copyText(await text())) toast('Texte copié : colle-le dans la discussion.');
        })}><Icon name="copy" />Copier le texte</button>
        <button className="btn" disabled={busy} onClick={() => run(async () => {
          const l = await link();
          if (!(await shareNative({ url: l, title: 'Une main de poker' })) && (await copyText(l))) toast('Lien copié.');
        })}><Icon name="link" />Lien</button>
        <button className="btn" disabled={busy} onClick={() => run(async () => {
          const blob = await handImage(hand, all);
          const file = new File([blob], 'main-ppc.png', { type: 'image/png' });
          if (!(canShareFiles(file) && (await shareNative({ files: [file] })))) download(blob, 'main-ppc.png');
        })}><Icon name="image" />Image</button>
      </div>
      <p className="muted">Le lien ouvre le rejoueur, sans compte. Ta note personnelle n'est jamais envoyée, et les adversaires ne sont désignés que par leur position.</p>
    </section>
  );
}
