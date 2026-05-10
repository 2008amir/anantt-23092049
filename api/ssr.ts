export const config = {
  runtime: "edge",
};

type ServerModule = {
  default: {
    fetch: (request: Request) => Response | Promise<Response>;
  };
};

export default async function handler(request: Request) {
  const server = (await import("../dist/server/index.js")) as ServerModule;
  return server.default.fetch(request);
}
