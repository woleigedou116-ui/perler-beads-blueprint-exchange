import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";

import type { PaletteMapping } from "../../domain/types";
import { PaletteReference } from "./PaletteReference";
import { projectWithOneReviewCell } from "./test-data";

afterEach(() => {
  cleanup();
});

const paletteMappings: PaletteMapping[] = [
  {
    source_code: "H7",
    source_rgb: { r: 14, g: 14, b: 14 },
    target_code: "B09",
    target_rgb: { r: 14, g: 14, b: 14 },
    requires_review: false,
  },
  {
    source_code: "F14",
    source_rgb: { r: 247, g: 152, b: 158 },
    target_code: "K07",
    target_rgb: { r: 247, g: 150, b: 157 },
    requires_review: false,
  },
  {
    source_code: "E20",
    source_rgb: { r: 239, g: 225, b: 233 },
    target_code: "K26",
    target_rgb: { r: 239, g: 224, b: 232 },
    requires_review: false,
  },
];

it("marks the floating palette trigger as a desktop reference while keeping its label", () => {
  const { container } = render(
    <PaletteReference
      paletteMappings={paletteMappings}
      project={projectWithOneReviewCell}
    />,
  );

  expect(container.firstElementChild).toHaveClass(
    "palette-reference",
    "desktop-palette-reference",
  );
  expect(screen.getByRole("button", { name: "色号表" })).toBeInTheDocument();
});

it("shows only current-project colors first, then the complete mapping list", async () => {
  const completePalette = [
    ...paletteMappings,
    ...Array.from({ length: 120 }, (_, index) => ({
      source_code: `A${index + 1}`,
      source_rgb: { r: 240, g: 240, b: 240 },
      target_code: `E${String(index + 1).padStart(2, "0")}`,
      target_rgb: { r: 240, g: 220, b: 120 },
      requires_review: true,
    })),
  ];
  render(
    <PaletteReference
      paletteMappings={completePalette}
      project={projectWithOneReviewCell}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: "色号表" }));

  expect(screen.getByText("H7 -> B09")).toBeInTheDocument();
  expect(screen.getByText("F14 -> K07")).toBeInTheDocument();
  expect(screen.getAllByText("1 颗")).toHaveLength(2);
  expect(screen.queryByText("E20 -> K26")).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "全部色号" }));

  expect(screen.getByText("E20 -> K26")).toBeInTheDocument();
  expect(screen.getByText("A120 -> E120")).toBeInTheDocument();
});

it("keeps palette counts aligned and labels missing swatches explicitly", async () => {
  const paletteWithBlankSide: PaletteMapping[] = [
    {
      source_code: "H3",
      source_rgb: null,
      target_code: "B03",
      target_rgb: { r: 180, g: 177, b: 184 },
      requires_review: true,
    },
    {
      source_code: "H4",
      source_rgb: { r: 255, g: 255, b: 255 },
      target_code: "B05",
      target_rgb: null,
      requires_review: true,
    },
  ];

  render(
    <PaletteReference
      paletteMappings={paletteWithBlankSide}
      project={{
        ...projectWithOneReviewCell,
        cells: [
          {
            ...projectWithOneReviewCell.cells[0],
            target_code: "B03",
          },
        ],
      }}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: "色号表" }));
  await userEvent.click(screen.getByRole("button", { name: "全部色号" }));

  const firstRow = screen.getByLabelText("H3 -> B03");
  expect(within(firstRow).getByLabelText("来源色样缺失")).toBeInTheDocument();
  expect(within(firstRow).getByText("1 颗")).toHaveClass("palette-count");

  const secondRow = screen.getByLabelText("H4 -> B05");
  expect(within(secondRow).getByLabelText("目标色样缺失")).toBeInTheDocument();
  expect(within(secondRow).getByLabelText("未使用")).toHaveClass("palette-count");
});
