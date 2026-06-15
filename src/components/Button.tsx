import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import {
  buttonClasses,
  type ButtonShape,
  type ButtonSize,
  type ButtonTone,
} from "./form-styles";

/**
 * The shared chrome control: the solid "second material" (`.chrome`), keyboard
 * focus ring and tactile press dip in one typed component. Renders a real
 * `<button>` by default, or a Next `<Link>` when `as="link"` (so navigation
 * controls and action buttons read identically).
 *
 * The press *sheen* + dip are driven globally by `GlassGlow` (it toggles
 * `.glass-press` on the frontmost `.chrome`/`.glass` under the pointer), so
 * nothing extra is wired per button here.
 *
 * Migration helper, additive: existing buttons are left as-is for now.
 */

type StyleProps = {
  tone?: ButtonTone;
  shape?: ButtonShape;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
};

type ButtonAsButton = StyleProps & {
  as?: "button";
} & Omit<ComponentProps<"button">, keyof StyleProps>;

type ButtonAsLink = StyleProps & {
  as: "link";
} & Omit<ComponentProps<typeof Link>, keyof StyleProps>;

export type ButtonProps = ButtonAsButton | ButtonAsLink;

export function Button({
  tone,
  shape,
  size,
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = buttonClasses({ tone, shape, size, className });

  if (rest.as === "link") {
    const { as: _as, ...linkProps } = rest;
    return (
      <Link className={classes} {...linkProps}>
        {children}
      </Link>
    );
  }

  const { as: _as, ...buttonProps } = rest;
  return (
    <button type="button" className={classes} {...buttonProps}>
      {children}
    </button>
  );
}
