import { readFileSync } from "node:fs";
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
  it("uses the transparent horizontal lockup on the sign-in card", () => {
    expect(clerkAppearance.layout?.logoImageUrl).toMatch(/clerk-logo\.png$/);
    expect(
      (clerkAppearance as { options?: { logoImageUrl?: string } }).options
        ?.logoImageUrl,
    ).toMatch(/clerk-logo\.png$/);
    expect(elements.logoImage.height).toBe("32px");
    expect(elements.logoImage.width).toBe("auto");
    expect(elements.logoImage.objectFit).toBe("contain");
    const png = readFileSync(
      new URL("../public/clerk-logo.png", import.meta.url),
    );
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(png[25]).toBe(6);
  });

  it("brands the primary form button with the mint lift-and-glow interaction", () => {
    expect(elements.formButtonPrimary.backgroundColor).toBe(ACCENT);
    expect(elements.formButtonPrimary.color).toBe(ACCENT_INK);
    expect(elements.formButtonPrimary["&:hover"].transform).toContain(
      "translateY",
    );
    expect(elements.formButtonPrimary["&:active"]).toBeDefined();
  });

  it("gives inputs and the verification-code fields an accent focus ring", () => {
    expect(elements.formFieldInput["&:focus"].borderColor).toBe(ACCENT);
    expect(elements.formFieldInput["&:focus"].boxShadow).toContain(
      "90, 214, 192",
    );
    expect(elements.otpCodeFieldInput["&:focus"].borderColor).toBe(ACCENT);
  });

  it("themes the social sign-in buttons on the dark surface with a hover accent", () => {
    expect(elements.socialButtonsBlockButton.backgroundColor).toBe("#0f161c");
    expect(elements.socialButtonsBlockButton["&:hover"].borderColor).toBe(
      ACCENT,
    );
  });

  it("renders the UserButton popover as a native dark panel", () => {
    expect(elements.userButtonPopoverCard.backgroundColor).toBe("#0f161c");
    expect(elements.userButtonPopoverCard.border).toContain("#1f2c37");
    expect(elements.userButtonPopoverActionButton["&:hover"]).toBeDefined();
    expect(elements.userButtonPopoverFooter.borderTop).toContain("#1f2c37");
  });

  it("matches custom UserButton items (Cloud namespace, Docs, Support) to the built-in action buttons", () => {
    // Clerk renders UserButton.Action/Link custom items with the
    // `userButtonPopoverCustomItemButton` descriptor, distinct from the
    // built-in Account settings / Sign out actions' descriptor
    // (`userButtonPopoverActionButton`). Without a matching entry for the
    // custom-item key, Clerk falls back to its own default: a greyed,
    // low-alpha color and a near-invisible hover, so the menu reads as two
    // different styles. Assert structural equality against the built-ins
    // (not just pinned literals) so this stays true even if the built-in
    // treatment changes later.
    expect(elements.userButtonPopoverCustomItemButton).toBeDefined();
    expect(elements.userButtonPopoverCustomItemButton.color).toBe(
      elements.userButtonPopoverActionButton.color,
    );
    expect(elements.userButtonPopoverCustomItemButton.transition).toBe(
      elements.userButtonPopoverActionButton.transition,
    );
    expect(elements.userButtonPopoverCustomItemButton["&:hover"]).toEqual(
      elements.userButtonPopoverActionButton["&:hover"],
    );
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
