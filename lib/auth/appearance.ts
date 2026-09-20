import type { ClerkAppearanceTheme } from "@clerk/nextjs/types";

/*
  Clerk's components are the only UI in the app we do not draw ourselves, so
  they are re-anchored onto our tokens instead of shipping Clerk's light
  defaults.

  The values are literals rather than `var(--color-…)` on purpose: Clerk
  derives shades and alpha steps from these colours at runtime, which it
  cannot do from an unresolved custom property. Each one names the token it
  mirrors so the two stay findable together.
*/
export const clerkAppearance: ClerkAppearanceTheme = {
  variables: {
    colorBackground: "#151515", // --color-panel
    colorForeground: "#f5f5f5", // --color-ink
    colorMutedForeground: "#a1a1aa", // --color-ink-secondary
    colorMuted: "#1d1d1d", // --color-card
    colorPrimary: "#f5f5f5", // filled actions are ink-on-canvas, as Button/primary is
    colorPrimaryForeground: "#0a0909", // --color-canvas
    colorInput: "#1e1e1e", // --color-field
    colorInputForeground: "#f5f5f5",
    colorBorder: "#252525", // --color-line
    colorNeutral: "#ffffff", // greys and interaction states are white at an alpha, as ours are
    colorDanger: "#f87171", // --color-critical
    colorSuccess: "#6ee86e", // --color-positive
    colorWarning: "#ffce47", // --color-caution
    colorModalBackdrop: "rgba(0, 0, 0, 0.62)", // --scrim-color
    colorShadow: "rgba(0, 0, 0, 0.45)",
    borderRadius: "10px", // --radius-control
    fontFamily: "var(--font-sans)",
  },
};

/*
  Bottom-left of the hub nav. The switcher takes the row and the user button
  sits at its end, together filling the 39px-tall slot the old
  "Personal · Local workspace" block occupied.
*/
export const orgSwitcherAppearance: ClerkAppearanceTheme = {
  elements: {
    rootBox: { minWidth: 0, flex: 1 },
    organizationSwitcherTrigger: {
      width: "100%",
      justifyContent: "flex-start",
      gap: "10px",
      padding: "6px 9px",
      borderRadius: "12px", // --radius-nav
      color: "#f5f5f5",
      "&:hover": { backgroundColor: "rgba(255, 255, 255, 0.08)" }, // --state-hover
    },
    organizationSwitcherTriggerIcon: { marginLeft: "auto" },
    organizationPreviewAvatarBox: { width: "32px", height: "32px" },
    organizationPreviewTextContainer: { minWidth: 0 },
    organizationPreviewMainIdentifier: { fontSize: "13px", letterSpacing: "0.8px" },
    organizationPreviewSecondaryIdentifier: { fontSize: "12px", letterSpacing: "0.8px" },
  },
};

export const userButtonAppearance: ClerkAppearanceTheme = {
  elements: {
    userButtonAvatarBox: { width: "32px", height: "32px" },
  },
};

/*
  The sign-in and sign-up cards sit alone on the canvas, so the card takes the
  panel tone and the surrounding page supplies the backdrop.
*/
export const authCardAppearance: ClerkAppearanceTheme = {
  elements: {
    cardBox: { borderRadius: "20px" }, // --radius-overlay
  },
};
