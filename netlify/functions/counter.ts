import { Context } from "@netlify/functions";
import { Redis } from "@upstash/redis";
import { isbot } from "isbot";

const redis = Redis.fromEnv();

export default async function (request: Request, context: Context) {
  if (isbot(request.headers.get("User-Agent"))) {
    return new Response("<!DOCTYPE html>", {
      headers: {
        "Content-Type": "text/html",
        "Content-Security-Policy": "frame-ancestors 'self'",
        "X-Frame-Options": "SAMEORIGIN",
      },
    });
  }

  const count =
    request.method === "POST"
      ? await redis.incr("count")
      : ((await redis.get<number>("count")) ?? 0);
  const digits = count.toString().split("");

  if (request.headers.get("Accept") === "application/json") {
    return Response.json({
      digits,
    });
  }

  const align = new URL(request.url).searchParams.get("align");
  const bodyClass = align === "left" ? "align-left" : "align-right";

  return new Response(
    `<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
    <link rel="stylesheet" href="/styles/counter.css">
  </head>
  <body class="${bodyClass}">
    <div class="visitors-container window window-utility window-utility-side">
      <div class="window-handle">
        <span class="window-button button-top"></span>
        <span class="window-button button-bottom button-minimize"></span>
      </div>
      <form class="window-contents" method="POST">
        <button type="submit">
          <img src="/assets/icons-16.png" alt="sheep" class="sprite-16" style="object-position: -48px 0">
          <div class="visitors">
            <div class="visitors-count" style="--num-digits: ${digits.length}">
              ${digits
                .map(
                  (digit) =>
                    `<span class="visitors-number" data-number="${digit}">${digit}</span>`,
                )
                .join("\n")}
            </div>
            <span class="visitors-label"> click me</span>
          </div>
        </button>
      </form>
    </div>
    <script type="text/javascript">
      document.querySelector("form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const response = await fetch("", {
          method: "POST",
          headers: { "Accept": "application/json" }
        });
        const { digits } = await response.json();
        const count = document.querySelector(".visitors-count");
        count.innerHTML = digits.map((digit) => \`<span class="visitors-number" data-number="\${digit}">\${digit}</span>\`).join("\\n");
        count.style.setProperty("--num-digits", digits.length);
      });
    </script>
  </body>
</html>
`,
    {
      headers: {
        "Content-Type": "text/html",
        "Content-Security-Policy": "frame-ancestors 'self'",
        "X-Frame-Options": "SAMEORIGIN",
      },
    },
  );
}
