/*
  The slices of Clerk's payloads we mirror, plus the mapping into our rows.

  Webhook events and the Backend API return the same resource shapes, so both
  paths share this file — the webhook must not learn a different idea of what a
  user's name is than the backfill has.

  Typed by hand rather than imported from `@clerk/backend`: this code is bundled
  for the Convex runtime, and the handful of fields below is all it reads.
*/

export type ClerkUser = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  image_url?: string | null;
  primary_email_address_id?: string | null;
  email_addresses?: { id: string; email_address: string }[];
};

export type ClerkOrganization = {
  id: string;
  name?: string | null;
  slug?: string | null;
  image_url?: string | null;
};

export type ClerkPublicUserData = {
  user_id: string;
  first_name?: string | null;
  last_name?: string | null;
  image_url?: string | null;
  /* Whatever the user signs in with — usually the primary email. */
  identifier?: string | null;
};

export type ClerkOrganizationMembership = {
  role: string;
  organization: ClerkOrganization;
  public_user_data?: ClerkPublicUserData | null;
};

const trimmed = (value?: string | null) => {
  const text = value?.trim();
  return text ? text : undefined;
};

const fullName = (first?: string | null, last?: string | null) =>
  trimmed([trimmed(first), trimmed(last)].filter(Boolean).join(" "));

export function orgInput(org: ClerkOrganization) {
  return {
    clerkOrgId: org.id,
    name: trimmed(org.name),
    slug: trimmed(org.slug),
    imageUrl: trimmed(org.image_url),
  };
}

export function userInput(user: ClerkUser) {
  const primary =
    user.email_addresses?.find((e) => e.id === user.primary_email_address_id) ?? user.email_addresses?.[0];
  return {
    clerkUserId: user.id,
    name: fullName(user.first_name, user.last_name) ?? trimmed(user.username),
    email: trimmed(primary?.email_address),
    imageUrl: trimmed(user.image_url),
  };
}

/* `public_user_data` is thinner than a user event's payload: no email address,
   only the identifier the user signs in with. Only an email is stored as one. */
export function memberUserInput(data: ClerkPublicUserData) {
  const identifier = trimmed(data.identifier);
  return {
    clerkUserId: data.user_id,
    name: fullName(data.first_name, data.last_name),
    email: identifier?.includes("@") ? identifier : undefined,
    imageUrl: trimmed(data.image_url),
  };
}
