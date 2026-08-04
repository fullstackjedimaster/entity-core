import { createEmbedProxy } from "@fsj/demo-kit/server";
export const proxy = createEmbedProxy({ audience: "entity-core" });
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
