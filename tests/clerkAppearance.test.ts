import { describe, expect, it } from "vitest";
import { clerkAppearance } from "../.vitepress/theme/clerk";

// These assertions lock in the "native AutoVault surface" theming for Clerk's
// hosted modals, UserButton popover, and account pages. They guard against a
// future refactor silently dropping the branded states back to Clerk defaults.
const elements = clerkAppearance.elements as Record<string, any>;
const variables = clerkAppearance.variables as Record<string, any>;

const ACCENT = "#5ad6c0";
const ACCENT_INK = "#062821";

describe("Clerk appearance — native AutoVault theming", () => {
  it("brands the primary form button with the mint lift-and-glow interaction", () => {
    expect(elements.formButtonPrimary.backgroundColor).toBe(ACCENT);
    expect(elements.formButtonPrimary.color).toBe(ACCENT_INK);
    expect(elements.formButtonPrimary["&:hover"].transform).toContain("translateY");
    expect(elements.formButtonPrimary["&:active"]).toBeDefined();
  });

  it("gives inputs and the verification-code fields an accent focus ring", () => {
    expect(elements.formFieldInput["&:focus"].borderColor).toBe(ACCENT);
    expect(elements.formFieldInput["&:focus"].boxShadow).toContain("90, 214, 192");
    expect(elements.otpCodeFieldInput["&:focus"].borderColor).toBe(ACCENT);
  });

  it("themes the social sign-in buttons on the dark surface with a hover accent", () => {
    expect(elements.socialButtonsBlockButton.backgroundColor).toBe("#0f161c");
    expect(elements.socialButtonsBlockButton["&:hover"].borderColor).toBe(ACCENT);
  });

  it("renders the UserButton popover as a native dark panel", () => {
    expect(elements.userButtonPopoverCard.backgroundColor).toBe("#0f161c");
    expect(elements.userButtonPopoverCard.border).toContain("#1f2c37");
    expect(elements.userButtonPopoverActionButton["&:hover"]).toBeDefined();
    expect(elements.userButtonPopoverFooter.borderTop).toContain("#1f2c37");
  });

  it("routes accents through links, spinner, and badges", () => {
    expect(elements.footerActionLink.color).toBe(ACCENT);
    expect(elements.formResendCodeLink.color).toBe(ACCENT);
    expect(elements.spinner.color).toBe(ACCENT);
    expect(elements.badge.color).toBe(ACCENT);
    expect(elements.navbarButtonIcon.color).toBe(ACCENT);
  });

  it("maps Clerk status colors to the site palette and preserves the blurred backdrop", () => {
    expect(variables.colorSuccess).toBe("#7bd88f");
    expect(variables.colorWarning).toBe("#e8a866");
    expect(variables.colorDanger).toBe("#d97171");
    expect(variables.colorTextOnPrimaryBackground).toBe(ACCENT_INK);
    expect(elements.modalBackdrop.backdropFilter).toContain("blur");
  });
});
