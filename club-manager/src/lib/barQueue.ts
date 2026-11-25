/**
 * Consos en attente de réseau. Chacune porte un identifiant créé sur l'appareil :
 * la renvoyer après une coupure ne la compte pas deux fois.
 */
export interface Op { id: string; member_id: string; item_id: string; label: string; price: number; guest: boolean; at: string }

interface Deps {
  load(): Op[];
  save(ops: Op[]): void;
  send(op: Op): Promise<void>;
  /** La conso est valable, c'est le réseau (ou le serveur) qui manque. */
  retry(e: unknown): boolean;
  onChange(): void;
  /** Refusée plus tard, sans personne pour l'apprendre autrement. */
  onLost(op: Op, e: unknown): void;
}

export function createQueue(d: Deps) {
  let ops = d.load();
  let running: Promise<void> | null = null;
  let sending: string | null = null;
  const waiters = new Map<string, { sent(): void; queued(): void; failed(e: unknown): void }>();
  const put = (next: Op[]) => { ops = next; d.save(ops); d.onChange(); };

  /** Vrai si tout est parti, faux si le réseau manque. */
  async function run(): Promise<boolean> {
    while (ops.length > 0) {
      const op = ops[0];
      sending = op.id;
      const w = waiters.get(op.id);
      try {
        await d.send(op);
        waiters.delete(op.id);
        put(ops.filter(o => o.id !== op.id));
        w?.sent();
      } catch (e) {
        if (d.retry(e)) return false;
        waiters.delete(op.id);
        put(ops.filter(o => o.id !== op.id));
        if (w) w.failed(e); else d.onLost(op, e);
      } finally {
        sending = null;
      }
    }
    return true;
  }

  const flush = (): Promise<void> => running ??= run().then(done => {
    running = null;
    if (done) return;
    // Prévenus une fois la tentative close : un nouvel essai repart de zéro.
    for (const x of waiters.values()) x.queued();
    waiters.clear();
  });
  return {
    list: () => ops,
    flush,
    /** Rend vrai si la conso attend le réseau, faux si elle est enregistrée. */
    add(op: Op): Promise<boolean> {
      put([...ops, op]);
      const p = new Promise<boolean>((resolve, reject) => waiters.set(op.id, { sent: () => resolve(false), queued: () => resolve(true), failed: reject }));
      // Un envoi en cours prendra celle-ci à son tour ; sinon on en lance un.
      void flush().then(() => { if (waiters.has(op.id)) void flush(); });
      return p;
    },
    /** Retire une conso jamais partie. Faux : elle est partie, ou en train de partir. */
    async drop(id: string): Promise<boolean> {
      if (sending === id) await flush();
      if (!ops.some(o => o.id === id)) return false;
      put(ops.filter(o => o.id !== id));
      waiters.get(id)?.queued();
      waiters.delete(id);
      return true;
    },
  };
}
export type Queue = ReturnType<typeof createQueue>;
