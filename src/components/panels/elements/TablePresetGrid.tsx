import React from 'react';
import { useCanvasObjects } from '@sabi-canvas/contexts/CanvasObjectsContext';

interface TablePresetGridProps {
  onClose: () => void;
}

interface TablePreset {
  rows: number;
  cols: number;
  label: string;
}

const PRESETS: TablePreset[] = [
  { rows: 2, cols: 2, label: '2 × 2' },
  { rows: 2, cols: 3, label: '2 × 3' },
  { rows: 2, cols: 4, label: '2 × 4' },
  { rows: 3, cols: 2, label: '3 × 2' },
  { rows: 3, cols: 3, label: '3 × 3' },
  { rows: 3, cols: 4, label: '3 × 4' },
  { rows: 4, cols: 2, label: '4 × 2' },
  { rows: 4, cols: 3, label: '4 × 3' },
  { rows: 4, cols: 4, label: '4 × 4' },
  { rows: 5, cols: 3, label: '5 × 3' },
  { rows: 5, cols: 4, label: '5 × 4' },
  { rows: 6, cols: 4, label: '6 × 4' },
];

function TablePreviewSvg({ rows, cols }: { rows: number; cols: number }) {
  const W = 64;
  const H = 48;
  const headerH = H / (rows + 0.5);
  const rowH = (H - headerH) / (rows > 1 ? rows - 1 : 1);
  const colW = W / cols;

  const lines: React.ReactNode[] = [];

  // vertical lines
  for (let c = 1; c < cols; c++) {
    lines.push(
      <line key={`v${c}`} x1={c * colW} y1={0} x2={c * colW} y2={H} stroke="#94a3b8" strokeWidth={0.8} />
    );
  }

  // horizontal lines (below header + each row)
  for (let r = 0; r < rows; r++) {
    const y = r === 0 ? headerH : headerH + (r) * rowH;
    lines.push(
      <line key={`h${r}`} x1={0} y1={y} x2={W} y2={y} stroke="#94a3b8" strokeWidth={0.8} />
    );
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      {/* header row */}
      <rect x={0} y={0} width={W} height={headerH} fill="#e2e8f0" />
      {/* body */}
      <rect x={0} y={headerH} width={W} height={H - headerH} fill="#ffffff" />
      {/* outer border */}
      <rect x={0} y={0} width={W} height={H} fill="none" stroke="#64748b" strokeWidth={1.2} />
      {lines}
    </svg>
  );
}

export const TablePresetGrid: React.FC<TablePresetGridProps> = ({ onClose }) => {
  const { addTable } = useCanvasObjects();

  const handleSelect = (preset: TablePreset) => {
    addTable(preset.rows, preset.cols);
    onClose();
  };

  return (
    <div className="p-0">
      <div className="grid grid-cols-3 gap-2">
        {PRESETS.map((preset) => (
          <button
            key={`${preset.rows}x${preset.cols}`}
            onClick={() => handleSelect(preset)}
            className="flex flex-col items-center gap-1.5 p-0 rounded-none border border-border/50 bg-card hover:bg-accent hover:border-primary/30 transition-all group"
            title={`${preset.rows} rows × ${preset.cols} columns`}
          >
            <div className="w-full aspect-[4/3] flex items-center justify-center overflow-hidden rounded-none">
              <TablePreviewSvg rows={preset.rows} cols={preset.cols} />
            </div>
            <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
              {preset.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
