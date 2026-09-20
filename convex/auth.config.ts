/*
  Clerk is the only issuer Convex accepts tokens from. `domain` is the Clerk
  instance's Frontend API URL and `applicationID` is the audience Clerk's JWT
  template named `convex` stamps on the token, so a token minted for anything
  else is rejected.

  `CLERK_FRONTEND_API_URL` is an environment variable on the Convex deployment
  (`npx convex env set CLERK_FRONTEND_API_URL …`), not on Vercel: auth.config.ts
  is evaluated by the deployment, which cannot see the app's build env.
*/
const authConfig = {
  providers: [
    {
      domain: process.env.CLERK_FRONTEND_API_URL,
      applicationID: "convex",
    },
  ],
};

export default authConfig;
