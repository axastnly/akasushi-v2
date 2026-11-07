"use client";

import { useEffect, useRef, useState } from "react";
import Chrome from "@/components/Chrome";
import Footer from "@/components/Footer";
import ReserveModalProvider from "@/components/ReserveModalProvider";
import { asset } from "@/lib/paths";
import { menuData, type MenuCategory } from "@/lib/menuData";

/* Ported from Figma (AKA Design, node 878:733 "Vertical Menu") — its own
   React/CSS code layer, adapted as-is. Only two real changes from the
   design: fonts swapped for this project's --font-display/--font-ui
   tokens (design used Georgia/Helvetica placeholders), and the design's
   own header + reservation dialog dropped in favor of the site's actual
   Chrome navbar + ReserveModal, so Reserve behaves identically here and
   on the homepage. Everything else — layout, spacing, colors, the real
   menu content — is unchanged. */

function MenuHero() {
  return (
    <div className="dish-hero">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="dish-hero__texture" src={asset("/assets/menu/dish-texture.png")} alt="" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="dish-hero__plate"
        src={asset("/assets/menu/dish-plate.png")}
        alt="Signature sushi presented on a red ceramic plate"
      />
    </div>
  );
}

function MenuSection({ category }: { category: MenuCategory }) {
  return (
    <section id={category.id} className="menu-section" aria-labelledby={`${category.id}-heading`}>
      <h2 id={`${category.id}-heading`}>{category.title}</h2>
      <div className="menu-grid">
        {category.dishes.map((item, index) => (
          <article className="menu-item" key={`${category.id}-${item.name}-${index}`}>
            <div>
              {item.group && <p className="menu-item__group">{item.group}</p>}
              <h3>{item.name}</h3>
              {(item.description || item.allergens) && (
                <div className="menu-item__details">
                  {item.description && <p>{item.description}</p>}
                  {item.allergens && <p>{item.allergens}</p>}
                </div>
              )}
            </div>
            <p className="menu-item__price">{item.price}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function MenuPage() {
  const [activeCategory, setActiveCategory] = useState(menuData[0].id);
  const headerRef = useRef<HTMLElement | null>(null);
  const categorySelectorRef = useRef<HTMLElement>(null);

  useEffect(() => {
    headerRef.current = document.querySelector(".chrome");
    let animationFrame: number | null = null;

    const updateActiveCategory = () => {
      animationFrame = null;

      // A section stays active until its bottom has passed all sticky UI.
      // This creates one ordered hand-off between adjacent sections.
      const stickyBoundary = Math.max(
        headerRef.current?.getBoundingClientRect().bottom ?? 0,
        categorySelectorRef.current?.getBoundingClientRect().bottom ?? 0,
      );
      const currentSection =
        menuData.find(({ id }) => {
          const section = document.getElementById(id);
          return section && section.getBoundingClientRect().bottom > stickyBoundary;
        }) ?? menuData[menuData.length - 1];

      if (currentSection) {
        setActiveCategory((current) => (current === currentSection.id ? current : currentSection.id));
      }
    };

    const requestUpdate = () => {
      if (animationFrame === null) animationFrame = requestAnimationFrame(updateActiveCategory);
    };

    requestUpdate();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);

    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
    };
  }, []);

  const selectCategory = (categoryId: string) => {
    document.getElementById(categoryId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <ReserveModalProvider>
      <Chrome alwaysVisible blur />
      <div className="menu-page">
        <main id="menu" className="menu-layout">
          <aside className="category-selector" ref={categorySelectorRef} aria-label="Menu categories">
            {menuData.map((category) => (
              <button
                type="button"
                key={category.id}
                className={activeCategory === category.id ? "category-tab category-tab--active" : "category-tab"}
                onClick={() => selectCategory(category.id)}
                aria-current={activeCategory === category.id ? "location" : undefined}
              >
                {category.title}
              </button>
            ))}
          </aside>

          <div className="menu-content">
            <h1>Menu</h1>
            <div className="sections">
              <MenuHero />
              {menuData.map((category) => (
                <MenuSection category={category} key={category.id} />
              ))}
            </div>
          </div>
        </main>
      </div>
      <Footer />
    </ReserveModalProvider>
  );
}
