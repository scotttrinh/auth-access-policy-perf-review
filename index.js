import { createClient } from "edgedb";
import {
  randomUUID,
  randomBytes,
  createSign,
  createSecretKey,
} from "node:crypto";
import jwt from "jsonwebtoken";

console.time("Resetting database");
const anonClient = createClient();

await anonClient.query(`delete User; delete ext::auth::Identity;`);
console.timeEnd("Resetting database");

console.time("Configuring auth");
const key = createSecretKey(randomBytes(32).toString("hex"));
const keyHex = key.export({ format: "buffer" });

await anonClient.query(`
  configure current database reset ext::auth::ProviderConfig;
  configure current database reset ext::auth::AuthConfig;

  configure current database set ext::auth::AuthConfig::auth_signing_key := '${keyHex.toString(
    "utf-8"
  )}';
`);
console.timeEnd("Configuring auth");

console.time("Inserting identities and users");
const subs = Array.from({ length: 1000 }).map(() => randomUUID());
await anonClient.query(
  `
  with subs := <array<str>>$subs
  for sub in array_unpack(subs) union (
    insert User {
      identity := (
        insert ext::auth::Identity {
          subject := sub,
          issuer := "https://example.com",
        }
      )
    }
  );
`,
  { subs }
);
console.timeEnd("Inserting identities and users");

console.time("Getting an identity");
const identity = await anonClient.queryRequiredSingle(
  `select assert_exists(assert_single((select ext::auth::Identity filter .subject = <str>$sub)))`,
  { sub: subs[0] }
);
console.timeEnd("Getting an identity");

console.time("Generating a manual JWT");
const token = jwt.sign(
  { iss: "https://example.com", sub: identity.id },
  key,
  { algorithm: "HS256" }
);

console.log("Raw JWT:", token);
console.log("Decoded JWT:", JSON.stringify(jwt.verify(token, key), null, 2));

const client = anonClient.withGlobals({
  "ext::auth::client_token": token,
});
console.timeEnd("Generating a manual JWT");

console.time("all users");
await client.query("select User");
console.timeEnd("all users");

console.time("identity");
console.log(
  "global ext::Auth::ClientTokenIdentity",
  await client.query("select global ext::auth::ClientTokenIdentity")
);
console.timeEnd("identity");

console.time("current user");
await client.query(
  "select User filter .identity ?= global ext::auth::ClientTokenIdentity"
);
console.timeEnd("current user");
