import { useMemo, useState } from "react";

import type { BeadProject, PaletteMapping, RGB } from "../../domain/types";

interface PaletteReferenceProps {
  paletteMappings: PaletteMapping[];
  project: BeadProject;
}

type PaletteMode = "used" | "all";

function rgbStyle(rgb: RGB | null) {
  if (!rgb) {
    return { background: "#ffffff" };
  }
  return { background: `rgb(${rgb.r} ${rgb.g} ${rgb.b})` };
}

export function PaletteReference({ paletteMappings, project }: PaletteReferenceProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PaletteMode>("used");

  const usedCounts = useMemo(
    () =>
      project.cells.reduce<Record<string, number>>((counts, cell) => {
        if (cell.target_code && cell.status !== "empty") {
          counts[cell.target_code] = (counts[cell.target_code] ?? 0) + 1;
        }
        return counts;
      }, {}),
    [project],
  );

  const rows = useMemo(() => {
    if (mode === "all") {
      return paletteMappings;
    }
    const usedCodes = new Set(Object.keys(usedCounts));
    return paletteMappings.filter(
      (mapping) => mapping.target_code && usedCodes.has(mapping.target_code),
    );
  }, [mode, paletteMappings, usedCounts]);

  return (
    <div className="palette-reference">
      <button className="palette-fab" type="button" onClick={() => setOpen((next) => !next)}>
        色号表
      </button>
      {open ? (
        <section className="palette-popover" aria-label="色号对照表">
          <header>
            <h2>色号对照表</h2>
            <button type="button" onClick={() => setOpen(false)}>
              关闭
            </button>
          </header>
          <div className="palette-tabs">
            <button
              className={mode === "used" ? "active" : ""}
              type="button"
              onClick={() => setMode("used")}
            >
              本图用到
            </button>
            <button
              className={mode === "all" ? "active" : ""}
              type="button"
              onClick={() => setMode("all")}
            >
              全部色号
            </button>
          </div>
          <div className="palette-reference-list">
            {rows.map((mapping) => (
              <article key={`${mapping.source_code}-${mapping.target_code}`}>
                <div className="palette-swatch" style={rgbStyle(mapping.source_rgb)} />
                <strong>
                  {mapping.source_code} -&gt; {mapping.target_code ?? "?"}
                </strong>
                <div className="palette-swatch" style={rgbStyle(mapping.target_rgb)} />
                {mapping.target_code && usedCounts[mapping.target_code] ? (
                  <span>{usedCounts[mapping.target_code]} 颗</span>
                ) : null}
              </article>
            ))}
            {rows.length === 0 ? <p>当前图纸暂无可显示色号。</p> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
