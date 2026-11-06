import { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary";

type AsButton = ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
type AsLink = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

type ButtonProps = (AsButton | AsLink) & {
  variant?: Variant;
  children: ReactNode;
};

/* Ported from the parallel Next.js build's Button component — same
   primary/secondary variants and sizing (see .btn/.btn--primary/
   .btn--secondary in globals.css). Renders as <a> when given an href
   (the Reserve CTA in Chrome links to #reserve) or <button> otherwise. */
export default function Button({ variant = "primary", children, className = "", ...props }: ButtonProps) {
  const classes = `btn btn--${variant} ${className}`.trim();

  if ("href" in props && props.href !== undefined) {
    return (
      <a className={classes} {...(props as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </a>
    );
  }

  return (
    <button className={classes} {...(props as ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children}
    </button>
  );
}
