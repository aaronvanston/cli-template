interface Item {
  id: string;
  name: string;
  status: string;
}

const initialItems: readonly Item[] = [
  { id: "item-1", name: "Read the template guide", status: "active" },
  { id: "item-2", name: "Replace the example module", status: "active" },
];

const json = (data: unknown, status = 200): Response =>
  Response.json(data, { status });

const isObjectBody = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const objectBody = async (
  request: Request
): Promise<Record<string, unknown>> => {
  try {
    const body: unknown = await request.json();
    return isObjectBody(body) ? body : {};
  } catch {
    return {};
  }
};

const itemId = (pathname: string): string | undefined => {
  const encodedId = /^\/items\/(?<id>[^/]+)$/u.exec(pathname)?.groups?.id;
  return encodedId === undefined || encodedId === ""
    ? undefined
    : decodeURIComponent(encodedId);
};

const handleItemsCollection = async (
  request: Request,
  url: URL,
  items: Item[]
): Promise<Response> => {
  if (request.method === "GET") {
    const limit = Math.max(
      1,
      Math.min(100, Number(url.searchParams.get("limit") ?? "20"))
    );
    return json({ items: items.slice(0, limit) });
  }

  if (request.method === "POST") {
    const body = await objectBody(request);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name === "") {
      return json({ error: "name is required" }, 400);
    }
    const item = {
      id: `item-${items.length + 1}`,
      name,
      status: "active",
    };
    items.push(item);
    return json(item, 201);
  }

  return json({ error: "method not allowed" }, 405);
};

const handleItem = async (
  request: Request,
  index: number,
  items: Item[]
): Promise<Response> => {
  const existing = items[index];
  if (existing === undefined) {
    return json({ error: "item not found" }, 404);
  }

  if (request.method === "GET") {
    return json(existing);
  }

  if (request.method === "PUT") {
    const body = await objectBody(request);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name === "") {
      return json({ error: "name is required" }, 400);
    }
    const item = {
      id: existing.id,
      name,
      status: typeof body.status === "string" ? body.status : "active",
    };
    items[index] = item;
    return json(item);
  }

  if (request.method === "PATCH") {
    const body = await objectBody(request);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const item = {
      ...existing,
      ...(name === "" ? {} : { name }),
      ...(typeof body.status === "string" ? { status: body.status } : {}),
    };
    items[index] = item;
    return json(item);
  }

  if (request.method === "DELETE") {
    items.splice(index, 1);
    return json(existing);
  }

  return json({ error: "method not allowed" }, 405);
};

const createExampleHandler = (): ((request: Request) => Promise<Response>) => {
  const items = initialItems.map((item) => ({ ...item }));

  return async function handleExampleRequest(
    request: Request
  ): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return json({ status: "ok", version: "example" });
    }

    if (url.pathname === "/items") {
      return await handleItemsCollection(request, url, items);
    }

    const id = itemId(url.pathname);
    const index =
      id === undefined ? -1 : items.findIndex((item) => item.id === id);
    if (index < 0) {
      return json({ error: "item not found" }, 404);
    }

    return await handleItem(request, index, items);
  };
};

if (import.meta.main) {
  const port = Number(process.env.CLI_TEMPLATE_EXAMPLE_PORT ?? "8787");
  const server = Bun.serve({
    fetch: createExampleHandler(),
    hostname: "127.0.0.1",
    port,
  });

  console.error(`Example API listening on ${server.url}`);
  console.error("Press Ctrl-C to stop.");
}
