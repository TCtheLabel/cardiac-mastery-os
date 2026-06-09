import Link from "next/link";

const links = [
  { href: "/", label: "Home" },
  { href: "/capture", label: "Capture" },
  { href: "/training", label: "Training" },
  { href: "/mastery", label: "Mastery" },
];

export function Nav() {
  return (
    <header className="border-b border-border/40">
      <nav className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <Link href="/" className="text-sm font-medium tracking-wide text-foreground/90">
          Cardiac Mastery OS
        </Link>
        <ul className="flex items-center gap-6">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
