export function drawHappyMac<
  C extends CanvasRenderingContext2D = CanvasRenderingContext2D,
>(context: C, x = 0, y = 0) {
  context.fillStyle = "white";
  context.fillRect(x - 1, y - 1, 10, 4);
  context.fillRect(x + 2, y - 1, 4, 8);
  context.fillRect(x, y + 6, 8, 4);

  context.fillStyle = "black";
  context.fillRect(x, y, 1, 2);
  context.fillRect(x + 4, y, 1, 6);
  context.fillRect(x + 3, y + 5, 2, 1);
  context.fillRect(x + 7, y, 1, 2);
  context.fillRect(x + 1, y + 7, 1, 1);
  context.fillRect(x + 6, y + 7, 1, 1);
  context.fillRect(x + 2, y + 8, 4, 1);
}
