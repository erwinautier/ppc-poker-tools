/** Consos sans réseau : rien de perdu, rien en double, l'ordre gardé. */
import { beforeEach, expect, it } from 'vitest';
import { createQueue, type Op, type Queue } from '../src/lib/barQueue';

const op = (id: string): Op => ({ id, member_id: 'm', item_id: 'i', label: 'Café', price: 50, guest: false, at: '' });
let store: Op[], sent: string[], lost: string[], online: boolean, refuse: string[], gate: Promise<void> | null, calls: number;
const make = (): Queue => createQueue({
  load: () => [...store], save: o => { store = [...o]; }, onChange: () => {}, onLost: o => lost.push(o.id),
  retry: e => e instanceof TypeError,
  send: async o => {
    calls++;
    await gate;
    if (!online) throw new TypeError('Failed to fetch');
    if (refuse.includes(o.id)) throw new Error('refusée');
    sent.push(o.id);
  },
});
beforeEach(() => { store = []; sent = []; lost = []; online = true; refuse = []; gate = null; calls = 0; });

it('en ligne : envoyée, puis oubliée', async () => {
  const q = make();
  expect(await q.add(op('a'))).toBe(false);
  expect([sent, store, q.list()]).toEqual([['a'], [], []]);
});
it('sans réseau : gardée sur l\'appareil, envoyée dans l\'ordre au retour', async () => {
  const q = make();
  online = false;
  expect(await Promise.all([q.add(op('a')), q.add(op('b')), q.add(op('c'))])).toEqual([true, true, true]);
  expect([sent, store.map(o => o.id)]).toEqual([[], ['a', 'b', 'c']]);
  await q.flush();
  expect(store).toHaveLength(3);
  online = true;
  await q.flush();
  expect([sent, store]).toEqual([['a', 'b', 'c'], []]);
});
it('survit à la fermeture de la page', async () => {
  online = false;
  await make().add(op('a'));
  online = true;
  const q = make();
  expect(q.list().map(o => o.id)).toEqual(['a']);
  await q.flush();
  expect(sent).toEqual(['a']);
});
it('tapes rapides : une seule file, chacune envoyée une fois', async () => {
  const q = make();
  const r = await Promise.all(Array.from({ length: 20 }, (_, i) => q.add(op(`x${i}`))));
  expect(r.every(x => x === false)).toBe(true);
  expect([sent.length, new Set(sent).size, calls]).toEqual([20, 20, 20]);
});
it('refusée par une règle : la personne l\'apprend, la suite passe', async () => {
  const q = make();
  refuse = ['a'];
  const a = q.add(op('a')), b = q.add(op('b'));
  await expect(a).rejects.toThrow('refusée');
  expect(await b).toBe(false);
  expect([sent, store, lost]).toEqual([['b'], [], []]);
});
it('refusée plus tard, au retour du réseau : signalée', async () => {
  const q = make();
  online = false;
  await q.add(op('a')); await q.add(op('b'));
  online = true; refuse = ['a'];
  await q.flush();
  expect([sent, lost, store]).toEqual([['b'], ['a'], []]);
});
it('annuler avant l\'envoi : jamais envoyée', async () => {
  const q = make();
  online = false;
  await q.add(op('a')); await q.add(op('b'));
  expect(await q.drop('a')).toBe(true);
  online = true;
  await q.flush();
  expect([sent, await q.drop('b')]).toEqual([['b'], false]);
});
it('annuler pendant l\'envoi : on attend, puis c\'est à la base d\'annuler', async () => {
  const q = make();
  let open!: () => void;
  gate = new Promise(r => { open = r; });
  const a = q.add(op('a'));
  const dropped = q.drop('a');
  open();
  expect(await dropped).toBe(false);
  expect([await a, sent]).toEqual([false, ['a']]);
});
it('annuler pendant un envoi qui échoue : retirée de la file', async () => {
  const q = make();
  let open!: () => void;
  gate = new Promise(r => { open = r; });
  online = false;
  const a = q.add(op('a'));
  const dropped = q.drop('a');
  open();
  expect(await dropped).toBe(true);
  expect([await a, store]).toEqual([true, []]);
});
