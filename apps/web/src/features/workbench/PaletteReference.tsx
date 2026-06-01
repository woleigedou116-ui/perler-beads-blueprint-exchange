import { useMemo, useState } from "react";

import type { BeadProject, PaletteMapping, RGB } from "../../domain/types";

interface PaletteReferenceProps {
  paletteMappings: PaletteMapping[];
  project: BeadProject;
}

type PaletteMode = "used" | "all";

function rgbStyle(rgb: RGB) {
  return { background: `rgb(${rgb.r} ${rgb.g} ${rgb.b})` };
}

function isLightSwatch(rgb: RGB) {
  return rgb.r > 238 && rgb.g > 238 && rgb.b > 238;
}

function Swatch({ rgb, label }: { rgb: RGB | null; label: string }) {
  if (!rgb) {
    return (
      <div
        aria-label={`${label}缺失`}
        className="palette-swatch is-missing"
        title={`${label}缺失`}
      />
    );
  }
  return (
    <div
      aria-label={`${label} rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`}
      className={`palette-swatch${isLightSwatch(rgb) ? " is-light" : ""}`}
      style={rgbStyle(rgb)}
      title={`${label} rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`}
    />
  );
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
    <div className="palette-reference desktop-palette-reference">
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
            {rows.map((mapping) => {
              const usedCount = mapping.target_code ? usedCounts[mapping.target_code] : 0;
              return (
              <article
                aria-label={`${mapping.source_code} -> ${mapping.target_code ?? "?"}`}
                key={`${mapping.source_code}-${mapping.target_code}`}
              >
                <Swatch label="来源色样" rgb={mapping.source_rgb} />
                <strong>
                  {mapping.source_code} -&gt; {mapping.target_code ?? "?"}
                </strong>
                <Swatch label="目标色样" rgb={mapping.target_rgb} />
                <span
                  aria-label={usedCount ? `${usedCount} 颗` : "未使用"}
                  className="palette-count"
                >
                  {usedCount ? `${usedCount} 颗` : ""}
                </span>
              </article>
              );
            })}
            {rows.length === 0 ? <p>当前图纸暂无可显示色号。</p> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
