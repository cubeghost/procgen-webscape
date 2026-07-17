export default function () {
  return {
    url:
      process.env.CONTEXT === "production"
        ? process.env.URL
        : process.env.CONTEXT === "dev"
          ? `http://localhost:${process.env.PORT ?? 8888}/`
          : (process.env.DEPLOY_PRIME_URL ?? process.env.URL),
    title: "cubegho.st",
  };
}
