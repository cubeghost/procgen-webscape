export function drawLoopedSquare<
  C extends CanvasRenderingContext2D = CanvasRenderingContext2D,
>(context: C, xPos = 0, yPos = 0, size = 14, loopSize = 4) {
  context.fillStyle = "white";
  context.fillRect(xPos, yPos, size, size);
  context.fillRect(xPos + 1, yPos - 1, size - 2, size + 2);
  context.fillRect(xPos - 1, yPos + 1, size + 2, size - 2);

  context.beginPath();
  context.strokeStyle = "black";
  context.lineWidth = 1;
  context.translate(0.5, 0.5);
  const delta = 0.5;

  let pos = { x: xPos + delta, y: yPos + delta };
  for (let i = 0; i < 4; i++) {
    const long = i % 2 === 0 ? "y" : "x";
    const short = i % 2 === 0 ? "x" : "y";

    const dirLong = i < 2 ? 1 : -1;
    const dirShort = i % 3 === 0 ? 1 : -1;
    const dl = delta * dirLong;
    const ds = delta * dirShort;

    pos[long] -= dl;
    context.moveTo(pos.x, pos.y);
    pos[short] += loopSize * dirShort;
    context.lineTo(pos.x, pos.y);
    pos[short] += ds;
    pos[long] += dl;
    context.moveTo(pos.x, pos.y);
    pos[long] += (size - 2) * dirLong;
    context.lineTo(pos.x, pos.y);
    pos[long] += dl;
    pos[short] -= ds;
    context.moveTo(pos.x, pos.y);
    pos[short] -= loopSize * dirShort;
    context.lineTo(pos.x, pos.y);
    pos[long] -= dl;
  }

  context.stroke();
  context.translate(-0.5, -0.5);
}
