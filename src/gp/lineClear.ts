import { drawBuffer, rows, columns } from "../canvas";

export function clearRow(row: number) {
  // shifts everything above the line down by one row
  for (let r = row; r < rows - 1; r++) {
    for (let c = 0; c < columns; c++) {
      drawBuffer[r * columns + c] = drawBuffer[(r + 1) * columns + c];
    }
  }

  // clear the last row
  for (let c = 0; c < columns; c++) {
    drawBuffer[(rows - 1) * columns + c] = 0;
  }
}
