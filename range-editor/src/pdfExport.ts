import { jsPDF } from 'jspdf';
import type { Range, PaletteColor } from './types';
import { cellToHand, combosCount } from './hands';

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

// Charge le logo en base64 depuis le dossier public
async function loadLogoBase64(): Promise<string | null> {
  try {
    const response = await fetch('/logo-ppc.jpg');
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

const PDF_FONT_SIZE: Record<string, number> = {
  sm: 5,
  md: 6.5,
  lg: 8.5,
};

export async function exportRangeToPDF(range: Range, fontSizeClass: 'sm' | 'md' | 'lg' = 'md'): Promise<void> {
  const logoBase64 = await loadLogoBase64();

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const margin = 15;
  const gridSize = pageW - margin * 2;
  const cellSize = gridSize / 13;

  // ── En-tête ──
  const logoSize = 18;
  const headerY = 12;

  if (logoBase64) {
    doc.addImage(logoBase64, 'JPEG', margin, headerY - 9, logoSize, logoSize);
  }

  const textX = logoBase64 ? margin + logoSize + 5 : margin;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(range.title, textX, headerY);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const meta = `${range.players} joueurs  |  ${range.position}  |  ${range.stackBB} BB`;
  doc.text(meta, textX, headerY + 7);

  // Ligne de séparation
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margin, headerY + 11, pageW - margin, headerY + 11);

  const gridTop = headerY + 16;

  // ── Matrice ──
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      const hand = cellToHand(r, c);
      const assignment = range.hands[hand] || {};
      const x = margin + c * cellSize;
      const y = gridTop + r * cellSize;

      const colorEntries = Object.entries(assignment)
        .map(([cid, freq]) => {
          const pc = range.palette.find((p: PaletteColor) => p.id === cid);
          return pc ? { hex: pc.hex, freq } : null;
        })
        .filter(Boolean) as { hex: string; freq: number }[];

      if (colorEntries.length === 0) {
        doc.setFillColor(240, 240, 240);
        doc.rect(x, y, cellSize, cellSize, 'F');
      } else if (colorEntries.length === 1) {
        const [cr, cg, cb] = hexToRgb(colorEntries[0].hex);
        doc.setFillColor(cr, cg, cb);
        doc.rect(x, y, cellSize, cellSize, 'F');
      } else {
        let xOff = x;
        const total = colorEntries.reduce((s, e) => s + e.freq, 0);
        for (const entry of colorEntries) {
          const w = (entry.freq / total) * cellSize;
          const [cr, cg, cb] = hexToRgb(entry.hex);
          doc.setFillColor(cr, cg, cb);
          doc.rect(xOff, y, w, cellSize, 'F');
          xOff += w;
        }
      }

      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.1);
      doc.rect(x, y, cellSize, cellSize, 'S');

      doc.setFontSize(PDF_FONT_SIZE[fontSizeClass]);
      doc.setTextColor(20, 20, 20);
      doc.text(hand, x + cellSize / 2, y + cellSize / 2 + 2, { align: 'center' });
    }
  }

  // ── Légende ──
  const legendTop = gridTop + 13 * cellSize + 8;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text('Légende', margin, legendTop);
  let lx = margin;
  for (const color of range.palette) {
    const [cr, cg, cb] = hexToRgb(color.hex);
    doc.setFillColor(cr, cg, cb);
    doc.rect(lx, legendTop + 3, 8, 5, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(color.label, lx + 10, legendTop + 7);
    lx += 45;
  }

  // ── Stats combos ──
  const totalCombos = 1326;
  let rangeCombo = 0;
  for (const [hand, assignment] of Object.entries(range.hands)) {
    const totalFreq = Object.values(assignment).reduce((s, v) => s + v, 0);
    if (totalFreq > 0) rangeCombo += (combosCount(hand) * Math.min(totalFreq, 100)) / 100;
  }
  const pct = ((rangeCombo / totalCombos) * 100).toFixed(1);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(80, 80, 80);
  doc.text(`${rangeCombo.toFixed(0)} combos — ${pct}% des mains possibles`, margin, legendTop + 15);

  // ── Remarques ──
  const notesTop = legendTop + 20;
  if (range.notes && range.notes.trim().length > 0) {
    // Ligne de séparation fine
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(margin, notesTop - 2, pageW - margin, notesTop - 2);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(60, 60, 60);
    doc.text('Remarques', margin, notesTop + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    // splitTextToSize gère le retour à la ligne automatiquement
    const lines = doc.splitTextToSize(range.notes.trim(), pageW - margin * 2);
    doc.text(lines, margin, notesTop + 10);
  }

  // ── Pied de page ──
  doc.setFontSize(7);
  doc.setTextColor(160, 160, 160);
  doc.text('Penthièvre Poker Club — Range Editor', pageW / 2, 290, { align: 'center' });

  doc.save(`${range.title.replace(/\s+/g, '_')}.pdf`);
}
