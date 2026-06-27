// flower from Susan Kare's Cairo dingbat font, updated version found on throw blanket
function drawCairoFlower<
  C extends CanvasRenderingContext2D = CanvasRenderingContext2D,
>(context: C, x = 0, y = 0) {
  context.fillStyle = "white";
  context.fillRect(x + 4, y, 4, 12);
  context.fillRect(x, y + 4, 12, 4);
  context.fillRect(x + 1, y + 1, 10, 10);

  context.fillStyle = "black";
  context.fillRect(x + 4, y + 1, 4, 10);
  context.fillRect(x + 5, y, 2, 1);
  context.fillRect(x + 5, y + 11, 2, 1);
  context.fillRect(x + 1, y + 4, 10, 4);
  context.fillRect(x, y + 5, 1, 2);
  context.fillRect(x + 11, y + 5, 1, 2);

  context.fillStyle = "white";
  context.fillRect(x + 5, y + 1, 2, 10);
  context.fillRect(x + 1, y + 5, 10, 2);
  context.fillRect(x + 4, y + 4, 4, 4);

  context.fillStyle = "black";
  context.fillRect(x + 5, y + 4, 2, 4);
  context.fillRect(x + 4, y + 5, 4, 2);

  context.fillRect(x + 2, y + 2, 1, 1);
  context.fillRect(x + 9, y + 2, 1, 1);
  context.fillRect(x + 2, y + 9, 1, 1);
  context.fillRect(x + 9, y + 9, 1, 1);
}
