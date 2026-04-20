import { Link } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer className="mt-32 border-t border-border/50 bg-card/30">
      <div className="container mx-auto grid gap-12 px-6 py-16 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-serif text-xl text-gold-gradient">MAISON</span>
            <span className="font-serif text-xl tracking-[0.3em] text-foreground">LUXE</span>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            A curated atelier of considered objects, sourced from the world's finest houses.
          </p>
        </div>
        <FooterCol title="Shop" links={[
          { to: "/shop", label: "All Pieces" },
          { to: "/shop", label: "Timepieces" },
          { to: "/shop", label: "Leather Goods" },
          { to: "/shop", label: "Fragrance" },
        ]} />
        <FooterCol title="Account" links={[
          { to: "/account", label: "My Account" },
          { to: "/orders", label: "Orders" },
          { to: "/wishlist", label: "Wishlist" },
          { to: "/cart", label: "Cart" },
        ]} />
        <FooterCol title="House" links={[
          { to: "/", label: "Our Story" },
          { to: "/", label: "Press" },
          { to: "/", label: "Contact" },
          { to: "/", label: "Concierge" },
        ]} />
      </div>
      <div className="border-t border-border/50">
        <div className="container mx-auto flex flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-muted-foreground md:flex-row">
          <p>© {new Date().getFullYear()} Maison Luxe. All rights reserved.</p>
          <p className="tracking-[0.2em]">CRAFTED WITH INTENTION</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { to: string; label: string }[] }) {
  return (
    <div>
      <h4 className="mb-4 text-xs uppercase tracking-[0.2em] text-primary">{title}</h4>
      <ul className="space-y-2">
        {links.map((l, i) => (
          <li key={i}>
            <Link to={l.to} className="text-sm text-muted-foreground transition-smooth hover:text-foreground">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
