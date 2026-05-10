export const config = {
  runtime: "edge",
};

type ServerModule = {
  default: {
    fetch: (request: Request) => Response | Promise<Response>;
  };
};

let serverModulePromise: Promise<ServerModule> | null = null;

export default async function handler(request: Request) {
  try {
    serverModulePromise ??= import("../dist/server/index.js") as Promise<ServerModule>;
    const server = await serverModulePromise;
    return await server.default.fetch(request);
  } catch (error) {
    console.error("Vercel SSR handler failed", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
