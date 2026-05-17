export const sparkles = [
  {
    draw(context, x = 0, y = 0) {
      context.fillStyle = "white";
      context.fillRect(x, y, 3, 3);
      context.fillStyle = "black";
      context.fillRect(x, y, 1, 1);
      context.fillRect(x + 2, y, 1, 1);
      context.fillRect(x + 1, y + 1, 1, 1);
      context.fillRect(x, y + 2, 1, 1);
      context.fillRect(x + 2, y + 2, 1, 1);
    },
    size: 3,
  },
  {
    draw(context, x = 0, y = 0) {
      context.fillStyle = "white";
      context.fillRect(x, y, 3, 3);
      context.fillStyle = "black";
      context.fillRect(x + 1, y, 1, 1);
      context.fillRect(x, y + 1, 1, 1);
      context.fillRect(x + 2, y + 1, 1, 1);
      context.fillRect(x + 1, y + 2, 1, 1);
    },
    size: 3,
  },
  {
    draw(context, x = 0, y = 0) {
      context.fillStyle = "white";
      context.fillRect(x + 1, y + 1, 3, 3);
      context.fillStyle = "black";
      context.fillRect(x + 2, y, 1, 2);
      context.fillRect(x, y + 2, 2, 1);
      context.fillRect(x + 3, y + 2, 2, 1);
      context.fillRect(x + 2, y + 3, 1, 2);
    },
    size: 5,
  },
  {
    draw(context, x = 0, y = 0) {
      context.fillStyle = "white";
      context.fillRect(x, y, 3, 3);
      context.fillStyle = "black";
      context.fillRect(x + 1, y, 1, 3);
      context.fillRect(x, y + 1, 3, 1);
    },
    size: 3,
  },
  {
    draw(context, x = 0, y = 0) {
      context.fillStyle = "black";
      context.fillRect(x, y, 3, 3);
      context.fillStyle = "white";
      context.fillRect(x + 1, y, 1, 3);
      context.fillRect(x, y + 1, 3, 1);
    },
    size: 3,
  },
  {
    draw(context, x = 0, y = 0) {
      context.fillStyle = "white";
      context.fillRect(x + 5, y, 1, 4);
      context.fillRect(x, y + 5, 4, 1);
      context.fillRect(x + 5, y + 7, 1, 4);
      context.fillRect(x + 7, y + 5, 4, 1);
      context.fillStyle = "black";
      context.fillRect(x + 5, y + 1, 1, 2);
      context.fillRect(x + 1, y + 5, 2, 1);
      context.fillRect(x + 5, y + 8, 1, 2);
      context.fillRect(x + 8, y + 5, 2, 1);
    },
    size: 11,
    weight: 0.3,
  },
  {
    draw(context, x = 0, y = 0) {
      context.fillStyle = "white";
      context.fillRect(x + 1, y, 3, 5);
      context.fillRect(x, y + 1, 5, 3);
      context.fillStyle = "black";
      context.fillRect(x + 2, y, 1, 1);
      context.fillRect(x + 1, y + 1, 1, 1);
      context.fillRect(x + 3, y + 1, 1, 1);
      context.fillRect(x, y + 2, 1, 1);
      context.fillRect(x + 4, y + 2, 1, 1);
      context.fillRect(x + 1, y + 3, 1, 1);
      context.fillRect(x + 3, y + 3, 1, 1);
      context.fillRect(x + 2, y + 4, 1, 1);
    },
    size: 5,
    weight: 0.3,
  },
  {
    draw(context, x = 0, y = 0) {
      context.fillStyle = "white";
      context.fillRect(x + 2, y + 1, 3, 5);
      context.fillRect(x + 1, y + 2, 5, 3);
      context.fillStyle = "black";
      context.fillRect(x + 3, y, 1, 2);
      context.fillRect(x + 2, y + 2, 1, 1);
      context.fillRect(x + 4, y + 2, 1, 1);
      context.fillRect(x, y + 3, 2, 1);
      context.fillRect(x + 5, y + 3, 2, 1);
      context.fillRect(x + 2, y + 4, 1, 1);
      context.fillRect(x + 4, y + 4, 1, 1);
      context.fillRect(x + 3, y + 5, 1, 2);
    },
    size: 7,
    weight: 0.1,
  },
  {
    // blank
    draw() {},
    size: 0,
    weight: 1,
  },
];

export const cumulativeSparkleWeights = sparkles.reduce((acc, value, index) => {
  acc[index] = (value.weight ?? 1) + (acc[index - 1] ?? 0);
  return acc;
}, [] as number[]);
