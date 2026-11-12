import React from "react";
import { categories } from "./catalog.mjs";
export function Icon({ name, ...props }) {
  const paths = {
    bag: "M5 7h14l1 14H4L5 7Zm4 1V6a3 3 0 0 1 6 0v2",
    search: "m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
    arrow: "M4 12h16m-6-6 6 6-6 6",
    truck:
      "M2 5h12v12H2zM14 9h4l4 4v4h-8M8 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0m12 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0",
    check: "m5 12 4 4L19 6",
    heart: "M20 4c-3-2-6 0-8 2-2-2-5-4-8-2-5 4 0 10 8 16 8-6 13-12 8-16Z",
    phone: "M6 3H3c-1 11 7 19 18 18v-4l-5-2-2 2c-4-2-5-3-7-7l2-2-3-5Z",
    close: "m6 6 12 12M18 6 6 18",
    menu: "M3 6h18M3 12h18M3 18h18",
    shield: "m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6l9-4Zm-4 9 3 3 5-6",
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name] || paths.arrow} />
    </svg>
  );
}
export function Logo() {
  return (
    <a className="logo" href="/" aria-label="Гілка свята — головна">
      <svg
        viewBox="0 0 48 48"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
      >
        <path d="M7 41 37 7M14 33 10 19m8 10-2-18m7 13 1-17m4 12 3-14M13 34l16-3m-9-5 16-4m-10-2 15-6" />
      </svg>
      <span>
        Гілка <i>свята</i>
        <small>РІЗДВО ПОЧИНАЄТЬСЯ ВДОМА</small>
      </span>
    </a>
  );
}
export function Header({
  count,
  query,
  setQuery,
  search,
  active,
  menu,
  setMenu,
}) {
  return (
    <>
      <div className="announcement">
        Трохи магії. Багато тепла. Ваше особливе Різдво.
      </div>
      <header className="header">
        <div className="header-main wrap">
          <Logo />
          <form className="search" action="/catalog" onSubmit={search}>
            <Icon name="search" />
            <input
              name="q"
              aria-label="Пошук товарів"
              placeholder="Знайти щось особливе…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button aria-label="Знайти товари" type="submit">
              <Icon name="arrow" />
            </button>
          </form>
          <a className="header-phone" href="tel:+380966462364">
            <Icon name="phone" />
            <span>
              096 646 23 64<small>Допоможемо з вибором</small>
            </span>
          </a>
          <a
            className="cart-link"
            href="/cart"
            aria-label={"Кошик, товарів: " + count}
          >
            <Icon name="bag" />
            <span>Кошик</span>
            <b>{count}</b>
          </a>
          <button
            className="menu-toggle"
            aria-label="Відкрити меню"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            <Icon name={menu ? "close" : "menu"} />
          </button>
        </div>
        <nav
          className={"navigation wrap " + (menu ? "expanded" : "")}
          aria-label="Головна навігація"
        >
          <a className={active === "catalog" ? "active" : ""} href="/catalog">
            Весь каталог
          </a>
          {categories.map((c) => (
            <a
              key={c.id}
              className={active === c.id ? "active" : ""}
              href={"/catalog/" + c.id}
            >
              {c.name}
            </a>
          ))}
          <a className="nav-help" href="/delivery">
            Доставка й оплата
          </a>
        </nav>
      </header>
    </>
  );
}
export function Hero() {
  return (
    <section className="hero">
      <img
        className="hero-image"
        src="/hero.webp"
        alt="Рубінова різдвяна куля на ялиновій гілці у теплому світлі гірлянди"
        fetchPriority="high"
      />
      <div className="wrap hero-content">
        <p className="eyebrow">КОЛЕКЦІЯ ТЕПЛИХ МОМЕНТІВ</p>
        <h1>
          Свято починається
          <br />з маленької <i>магії.</i>
        </h1>
        <p>
          Ялинки, прикраси та різдвяні деталі,
          <br />
          що перетворюють дім на місце щасливих спогадів.
        </p>
        <a className="button light" href="/catalog">
          Знайти своє свято <Icon name="arrow" />
        </a>
        <span className="hero-note">З любов’ю до вашого дому</span>
      </div>
      <span className="hero-caption">ГІЛКА СВЯТА · CHRISTMAS COLLECTION</span>
    </section>
  );
}
export function Footer() {
  return (
    <footer>
      <div className="wrap footer-grid">
        <div>
          <Logo />
          <p>
            Для дому, наповненого теплом.
            <br />
            Для моментів, які залишаються з нами.
          </p>
        </div>
        <div>
          <h3>Святкова колекція</h3>
          {categories.map((c) => (
            <a href={"/catalog/" + c.id} key={c.id}>
              {c.name}
            </a>
          ))}
        </div>
        <div>
          <h3>Покупцям</h3>
          <a href="/delivery">Доставка й оплата</a>
          <a href="/returns">Обмін і повернення</a>
          <a href="/privacy">Конфіденційність</a>
          <a href="/contacts">Контакти</a>
        </div>
        <div>
          <h3>Поговорімо про свято</h3>
          <a className="footer-phone" href="tel:+380966462364">
            096 646 23 64
          </a>
          <p>
            Телефонуйте, щоб уточнити деталі
            <br />
            та обрати свою колекцію.
          </p>
        </div>
      </div>
      <div className="wrap footer-bottom">
        <span>© {new Date().getFullYear()} Гілка свята</span>
        <span>Зроблено для теплих моментів</span>
        <span>Нова пошта · Укрпошта · monobank</span>
      </div>
    </footer>
  );
}
