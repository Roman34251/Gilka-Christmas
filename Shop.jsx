import React, { useEffect, useState } from "react";
import { Header, Hero, Footer, Icon } from "./Brand";
import { categories, money, productUrl } from "./catalog.mjs";
import Checkout from "./Checkout";
const categoryName = (id) =>
  categories.find((c) => c.id === id)?.name || "Різдвяні прикраси";
function Quantity({ value, onChange, name = "товару" }) {
  return (
    <div className="quantity">
      <button
        aria-label={"Зменшити кількість " + name}
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <output aria-label={"Кількість " + name}>{value}</output>
      <button
        aria-label={"Збільшити кількість " + name}
        disabled={value >= 99}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}
export function Empty({
  title = "Тут поки тихо",
  text = "Колекція незабаром поповниться новими товарами.",
}) {
  return (
    <div className="empty">
      <Icon name="bag" />
      <h2>{title}</h2>
      <p>{text}</p>
      <a className="button" href="/catalog">
        Переглянути каталог <Icon name="arrow" />
      </a>
    </div>
  );
}
function ProductCard({ p, add }) {
  return (
    <article className="product-card">
      <a className="product-image" href={productUrl(p)}>
        <img
          src={p.image}
          alt={p.name}
          loading="lazy"
          width="500"
          height="600"
        />
        {p.available === false && (
          <span className="badge">Немає в наявності</span>
        )}
        {p.oldPrice > p.price && (
          <span className="badge">
            −{Math.round((1 - p.price / p.oldPrice) * 100)}%
          </span>
        )}
      </a>
      <p className="product-category">{categoryName(p.category)}</p>
      <h3>
        <a href={productUrl(p)}>{p.name}</a>
      </h3>
      <div className="buy-line">
        <div>
          <strong>{money(p.price)}</strong>
          {p.oldPrice > p.price && <del>{money(p.oldPrice)}</del>}
        </div>
        <button
          disabled={p.available === false}
          className="add-button"
          onClick={() => add(p)}
          aria-label={"Додати до кошика: " + p.name}
        >
          <Icon name="bag" />
        </button>
      </div>
    </article>
  );
}
function Benefits() {
  return (
    <div className="benefits wrap">
      {[
        ["truck", "Доставка Новою поштою", "До відділення або поштомата"],
        ["shield", "Зручна оплата", "Онлайн або при отриманні"],
        ["heart", "Допомога з вибором", "Підберемо деталі до вашого свята"],
      ].map(([icon, title, text]) => (
        <div key={title}>
          <Icon name={icon} />
          <span>
            <strong>{title}</strong>
            <small>{text}</small>
          </span>
        </div>
      ))}
    </div>
  );
}
function Breadcrumb({ children }) {
  return (
    <nav className="breadcrumb" aria-label="Навігаційний шлях">
      <a href="/">Головна</a>
      <span>/</span>
      {children}
    </nav>
  );
}
function ProductPage({ p, items, add }) {
  const [photo, setPhoto] = useState(0),
    [quantity, setQuantity] = useState(1);
  return (
    <div className="wrap">
      <Breadcrumb>
        <a href={"/catalog/" + p.category}>{categoryName(p.category)}</a>
        <span>/</span>
        <span>{p.name}</span>
      </Breadcrumb>
      <div className="product-detail">
        <div>
          <div className="gallery-main">
            <img
              src={p.images[photo] || p.image}
              alt={p.name}
              width="800"
              height="900"
            />
          </div>
          {p.images.length > 1 && (
            <div className="thumbnails">
              {p.images.map((src, i) => (
                <button
                  key={i}
                  aria-label={"Фото " + (i + 1)}
                  aria-pressed={photo === i}
                  onClick={() => setPhoto(i)}
                >
                  <img src={src} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="product-info">
          <p className="eyebrow">{categoryName(p.category)}</p>
          <h1>{p.name}</h1>
          <p
            className={
              "availability " + (p.available === false ? "unavailable" : "")
            }
          >
            <Icon name={p.available === false ? "close" : "check"} />
            {p.available === false ? "Немає в наявності" : "В наявності"}
          </p>
          {p.sku && <p className="muted">Артикул: {p.sku}</p>}
          <div className="detail-price">
            {money(p.price)}{" "}
            {p.oldPrice > p.price && <del>{money(p.oldPrice)}</del>}
          </div>
          <p className="detail-description">
            {p.detail ||
              "За детальною інформацією про цей товар звертайтеся за телефоном 096 646 23 64."}
          </p>
          <div className="purchase">
            <Quantity value={quantity} onChange={setQuantity} />
            <button
              className="button"
              disabled={p.available === false}
              onClick={() => add(p, quantity)}
            >
              <Icon name="bag" />
              Додати до кошика
            </button>
          </div>
          <div className="detail-services">
            <div>
              <Icon name="truck" />
              <div>
                <strong>Нова пошта</strong>
                <p>
                  Відділення або поштомат. Вартість — за тарифами перевізника,
                  сплачується окремо. Термін відправлення підтвердимо після
                  замовлення.
                </p>
              </div>
            </div>
            <div>
              <Icon name="shield" />
              <div>
                <strong>Онлайн або при отриманні</strong>
                <p>
                  Оплата через monobank після підключення сервісу. Для
                  післяплати може діяти комісія перевізника.
                </p>
              </div>
            </div>
          </div>
          {p.category === "treats" && (
            <p className="notice">
              Для ікри спосіб доставки та температурний режим погоджуються
              окремо. Поштомат може бути недоступний.
            </p>
          )}
          <details open>
            <summary>Опис та характеристики</summary>
            <p className="preserve-lines">
              {p.detail || "Характеристики уточнюйте у продавця."}
            </p>
            {p.specifications?.length > 0 && (
              <dl className="specs">
                {p.specifications.map((s, i) => (
                  <React.Fragment key={i}>
                    <dt>{s.label}</dt>
                    <dd>{s.value}</dd>
                  </React.Fragment>
                ))}
              </dl>
            )}
          </details>
          <details>
            <summary>Обмін і повернення</summary>
            <p>
              Якщо з товаром виникла проблема, зателефонуйте 096 646 23 64.{" "}
              <a className="text-link" href="/returns">
                Детальніше про звернення
              </a>
            </p>
          </details>
        </div>
      </div>
      {items.some((item) => item.id !== p.id) && (
        <section className="section">
          <div className="section-head">
            <div>
              <p className="eyebrow">ДЕТАЛІ, ЩО ПОЄДНУЮТЬСЯ</p>
              <h2>Доповніть своє свято</h2>
            </div>
            <a className="text-link" href="/catalog">
              Весь каталог <Icon name="arrow" />
            </a>
          </div>
          <div className="product-grid">
            {items
              .filter((i) => i.id !== p.id)
              .slice(0, 4)
              .map((i) => (
                <ProductCard key={i.id} p={i} add={add} />
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
const info = {
  "/delivery": {
    title: "Доставка й оплата",
    body: (
      <>
        <h2>Доставка Новою поштою</h2>
        <p>
          Оберіть відділення або поштомат і вкажіть місто та номер точки
          отримання під час оформлення. Для великогабаритних ялинок доступність
          поштомата уточнюється після перевірки розмірів пакування.
        </p>
        <p>
          Доставка оплачується окремо за тарифами Нової пошти. Вартість і термін
          відправлення підтвердимо після перевірки замовлення.
        </p>
        <h2>Онлайн-оплата monobank</h2>
        <p>
          Коли онлайн-оплату активовано, після оформлення ви перейдете на
          захищену платіжну сторінку monobank. Магазин не отримує реквізити
          вашої картки.
        </p>
        <h2>Післяплата</h2>
        <p>
          Оплачуйте товари при отриманні. Окремо може стягуватися комісія за
          переказ коштів за чинними тарифами перевізника.
        </p>
        <h2>Доставка ікри</h2>
        <p>
          Потребує окремого погодження температурного режиму, пакування та
          термінів. Для таких замовлень залиште номер телефону — уточнимо умови
          до відправлення.
        </p>
      </>
    ),
  },
  "/returns": {
    title: "Обмін і повернення",
    body: (
      <>
        <h2>Ми на зв’язку</h2>
        <p>
          Якщо товар пошкоджений, не відповідає замовленню або ви хочете
          обговорити повернення, зателефонуйте 096 646 23 64. Підготуйте номер
          замовлення та фото товару й пакування.
        </p>
        <p>
          Огляньте посилку при отриманні. У разі пошкодження під час перевезення
          попросіть працівника перевізника зафіксувати його.
        </p>
        <p>
          Можливість і порядок повернення залежать від категорії товару, його
          стану та застосовних вимог законодавства. Для харчових продуктів умови
          відрізняються; деталі узгоджуються з продавцем.
        </p>
      </>
    ),
  },
  "/privacy": {
    title: "Конфіденційність",
    body: (
      <>
        <h2>Дані для вашого замовлення</h2>
        <p>
          Для оформлення потрібні ім’я, телефон, місто та точка доставки.
          Використовуємо їх для зв’язку, обробки замовлення та передачі
          перевізнику для доставки. Не просимо пароль від банку чи реквізити
          картки.
        </p>
        <h2>Платежі та кошик</h2>
        <p>
          Онлайн-платежі обробляє monobank на своїй захищеній сторінці. Кошик
          зберігається у браузері, щоб вибрані товари залишалися після оновлення
          сторінки.
        </p>
        <h2>Зв’язок</h2>
        <p>
          Щодо ваших даних звертайтеся за телефоном 096 646 23 64. Повні
          реквізити продавця та строки зберігання даних будуть оприлюднені перед
          запуском приймання замовлень.
        </p>
      </>
    ),
  },
  "/contacts": {
    title: "Поговорімо про ваше свято",
    body: (
      <>
        <p>
          Допоможемо підібрати ялинку, поєднати прикраси й уточнити деталі
          замовлення.
        </p>
        <a className="contact-number" href="tel:+380966462364">
          096 646 23 64
        </a>
        <p>
          Доставка Новою поштою по Україні. Умови для вашого населеного пункту
          уточнимо при підтвердженні.
        </p>
      </>
    ),
  },
};
export default function Shop({
  items,
  demo = false,
  path = "/",
  searchParams = {},
  commerce = {},
}) {
  const [cart, setCart] = useState({}),
    [ready, setReady] = useState(false),
    [notice, setNotice] = useState(""),
    [menu, setMenu] = useState(false),
    [query, setQuery] = useState(searchParams.q || ""),
    [sort, setSort] = useState(searchParams.sort || "default"),
    [onlyAvailable, setOnlyAvailable] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("hilka-cart") || "{}");
      setCart(
        Object.fromEntries(
          items
            .filter((p) => Number.isInteger(saved?.[p.id]) && saved[p.id] > 0)
            .map((p) => [p.id, Math.min(99, saved[p.id])]),
        ),
      );
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem("hilka-cart", JSON.stringify(cart));
      } catch {}
  }, [cart, ready]);
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(""), 4000);
      return () => clearTimeout(t);
    }
  }, [notice]);
  const change = (id, n) =>
    setCart((old) => ({ ...old, [id]: Math.max(0, Math.min(99, n)) }));
  const add = (p, n = 1) => {
    setCart((old) => ({ ...old, [p.id]: Math.min(99, (old[p.id] || 0) + n) }));
    setNotice(p.name + " — додано до кошика");
  };
  const lines = items
      .filter((p) => cart[p.id] > 0)
      .map((p) => ({ ...p, quantity: cart[p.id] })),
    total =
      lines.reduce(
        (sum, p) => sum + Math.round(p.price * 100) * p.quantity,
        0,
      ) / 100;
  const current = categories.find((c) => path === "/catalog/" + c.id),
    isCatalog = path.startsWith("/catalog"),
    product = path.startsWith("/product/")
      ? items.find((p) => productUrl(p) === path)
      : null;
  let visible = items.filter(
    (p) =>
      (!current || p.category === current.id) &&
      (!query ||
        p.name
          .toLocaleLowerCase("uk")
          .includes(query.toLocaleLowerCase("uk"))) &&
      (!onlyAvailable || p.available !== false),
  );
  if (sort === "price-up") visible.sort((a, b) => a.price - b.price);
  if (sort === "price-down") visible.sort((a, b) => b.price - a.price);
  if (sort === "name")
    visible.sort((a, b) => a.name.localeCompare(b.name, "uk"));
  const search = (e) => {
    if (isCatalog) {
      e.preventDefault();
      const url = new URL(window.location.href);
      url.searchParams.set("q", query);
      history.replaceState(null, "", url);
    }
  };
  return (
    <>
      <a className="skip" href="#main">
        Перейти до вмісту
      </a>
      <Header
        count={lines.reduce((n, p) => n + p.quantity, 0)}
        query={query}
        setQuery={setQuery}
        search={search}
        active={current?.id || (isCatalog ? "catalog" : "")}
        menu={menu}
        setMenu={setMenu}
      />
      {demo && (
        <div className="demo-banner">
          Демонстраційний перегляд: зразки товарів і цін. Реальні замовлення
          вимкнені.
        </div>
      )}
      <main id="main">
        {path === "/" && (
          <>
            <Hero />
            <Benefits />
            <section className="wrap section">
              <div className="section-head">
                <div>
                  <p className="eyebrow">ВАШЕ СВЯТО, ВАШІ ТРАДИЦІЇ</p>
                  <h2>З чого почнемо магію?</h2>
                </div>
                <p className="muted">
                  Усе для затишного дому
                  <br />
                  та особливого святкового столу.
                </p>
              </div>
              <div className="category-grid">
                {categories.map((c, i) => (
                  <a
                    className={"category-card category-" + c.id}
                    key={c.id}
                    href={"/catalog/" + c.id}
                  >
                    <div className="category-photo">
                      <img
                        src={c.image}
                        alt={c.name}
                        width="500"
                        height="600"
                        loading="lazy"
                      />
                      <span className="category-number">0{i + 1}</span>
                    </div>
                    <div>
                      <h3>{c.name}</h3>
                      <Icon name="arrow" />
                    </div>
                    <p>{c.caption}</p>
                  </a>
                ))}
              </div>
            </section>
            <section className="collection section">
              <div className="wrap">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">ОБЕРІТЬ СВОЮ ІСТОРІЮ</p>
                    <h2>Для ваших теплих моментів</h2>
                  </div>
                  <a className="text-link" href="/catalog">
                    Дивитися все <Icon name="arrow" />
                  </a>
                </div>
                {items.length ? (
                  <div className="product-grid">
                    {items.slice(0, 4).map((p) => (
                      <ProductCard key={p.id} p={p} add={add} />
                    ))}
                  </div>
                ) : (
                  <Empty />
                )}
              </div>
            </section>
            <section className="story wrap section">
              <div className="story-photo">
                <img
                  src="/hero.webp"
                  alt="Золоті та бордові прикраси серед ялинових гілок"
                  loading="lazy"
                  width="800"
                  height="700"
                />
              </div>
              <div>
                <p className="eyebrow">БІЛЬШЕ, НІЖ ПРИКРАСИ</p>
                <h2>
                  Те саме відчуття.
                  <br />
                  <i>Коли вдома — Різдво.</i>
                </h2>
                <p>
                  Знайомий блиск гірлянди. Улюблена куля на гілці. Стіл, за яким
                  збираються свої. Свято складається з деталей — і ми допоможемо
                  знайти ваші.
                </p>
                <a className="text-link" href="/catalog/decor">
                  Обрати різдвяні деталі <Icon name="arrow" />
                </a>
              </div>
            </section>
            <section className="help-strip">
              <div className="wrap">
                <div>
                  <p className="eyebrow">ОБИРАЄМО РАЗОМ</p>
                  <h2>Потрібна маленька підказка?</h2>
                  <p>Допоможемо знайти саме те, що пасуватиме вашому дому.</p>
                </div>
                <a className="button light" href="tel:+380966462364">
                  <Icon name="phone" />
                  096 646 23 64
                </a>
              </div>
            </section>
          </>
        )}
        {isCatalog && (
          <section className="wrap catalog-page">
            <Breadcrumb>
              <span>{current?.name || "Каталог"}</span>
            </Breadcrumb>
            <p className="eyebrow">СВЯТО У КОЖНІЙ ДЕТАЛІ</p>
            <h1>{current?.name || "Святкова колекція"}</h1>
            <p className="muted">
              {current?.caption ||
                "Знайдіть речі, з яких починаються ваші різдвяні традиції."}
            </p>
            <div className="category-tabs">
              <a aria-current={!current ? "page" : undefined} href="/catalog">
                Усе
              </a>
              {categories.map((c) => (
                <a
                  key={c.id}
                  aria-current={current?.id === c.id ? "page" : undefined}
                  href={"/catalog/" + c.id}
                >
                  {c.name}
                </a>
              ))}
            </div>
            <div className="catalog-toolbar">
              <span role="status">Товарів: {visible.length}</span>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={onlyAvailable}
                  onChange={(e) => setOnlyAvailable(e.target.checked)}
                />
                Лише в наявності
              </label>
              <label>
                Сортувати{" "}
                <select
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value);
                    const u = new URL(location.href);
                    u.searchParams.set("sort", e.target.value);
                    history.replaceState(null, "", u);
                  }}
                >
                  <option value="default">За замовчуванням</option>
                  <option value="price-up">Від дешевих до дорогих</option>
                  <option value="price-down">Від дорогих до дешевих</option>
                  <option value="name">За назвою</option>
                </select>
              </label>
            </div>
            {visible.length ? (
              <div className="product-grid">
                {visible.map((p) => (
                  <ProductCard key={p.id} p={p} add={add} />
                ))}
              </div>
            ) : (
              <Empty
                title={query ? "Нічого не знайшли" : "Колекція готується"}
                text={
                  query
                    ? "Спробуйте іншу назву або очистіть пошук."
                    : "Ми додаємо товари до цього розділу. Зателефонуйте, щоб дізнатися про асортимент."
                }
              />
            )}
          </section>
        )}
        {product && <ProductPage p={product} items={items} add={add} />}
        {path === "/cart" && (
          <section className="wrap page-section">
            <Breadcrumb>
              <span>Кошик</span>
            </Breadcrumb>
            <h1>Ваш маленький початок свята</h1>
            {!ready ? (
              <p role="status">Завантажуємо кошик…</p>
            ) : !lines.length ? (
              <Empty
                title="Кошик чекає на ваше свято"
                text="Додайте ялинку, прикраси чи щось смачненьке."
              />
            ) : (
              <div className="checkout-layout">
                <div>
                  {lines.map((p) => (
                    <article className="cart-row" key={p.id}>
                      <a href={productUrl(p)}>
                        <img src={p.image} alt={p.name} />
                      </a>
                      <div>
                        <p className="product-category">
                          {categoryName(p.category)}
                        </p>
                        <h3>
                          <a href={productUrl(p)}>{p.name}</a>
                        </h3>
                        <span>{money(p.price)}</span>
                        <Quantity
                          value={p.quantity}
                          name={p.name}
                          onChange={(n) => change(p.id, n)}
                        />
                        {p.available === false && (
                          <p className="error">
                            Товар більше не доступний. Видаліть його з кошика.
                          </p>
                        )}
                      </div>
                      <div className="cart-row-end">
                        <button
                          className="icon-button"
                          aria-label={"Видалити " + p.name}
                          onClick={() => change(p.id, 0)}
                        >
                          <Icon name="close" />
                        </button>
                        <strong>{money(p.price * p.quantity)}</strong>
                      </div>
                    </article>
                  ))}
                  <a className="text-link" href="/catalog">
                    Продовжити вибір <Icon name="arrow" />
                  </a>
                </div>
                <aside className="summary-card">
                  <h2>Ваше замовлення</h2>
                  <div className="summary-line">
                    <span>Товари</span>
                    <b>{money(total)}</b>
                  </div>
                  <div className="summary-line">
                    <span>Доставка</span>
                    <span>За тарифами НП</span>
                  </div>
                  <p className="muted">
                    Доставку та комісію післяплати сплачуєте окремо. Точні умови
                    підтвердимо перед відправленням.
                  </p>
                  <div className="summary-total">
                    <span>За товари</span>
                    <strong>{money(total)}</strong>
                  </div>
                  {lines.some((p) => p.available === false) ? (
                    <p className="error">
                      Видаліть недоступні товари, щоб продовжити.
                    </p>
                  ) : (
                    <a className="button full" href="/checkout">
                      Оформити замовлення <Icon name="arrow" />
                    </a>
                  )}
                  <p className="secure-note">
                    <Icon name="shield" />
                    Без обов’язкової реєстрації
                  </p>
                </aside>
              </div>
            )}
          </section>
        )}
        {(path === "/checkout" || path === "/order") && (
          <Checkout
            lines={lines}
            total={total}
            ready={ready}
            commerce={commerce}
            demo={demo}
            path={path}
            clear={() => setCart({})}
          />
        )}
        {info[path] && (
          <section className="wrap page-section info-page">
            <Breadcrumb>
              <span>{info[path].title}</span>
            </Breadcrumb>
            <h1>{info[path].title}</h1>
            {info[path].body}
          </section>
        )}
        {path === "/404" && (
          <Empty
            title="Ця стежка загубилась"
            text="Сторінку не знайдено. Повернімося до святкової колекції."
          />
        )}
      </main>
      <Footer />
      <div className={"toast " + (notice ? "show" : "")} role="status">
        {notice && (
          <>
            {notice}
            <a href="/cart">До кошика →</a>
          </>
        )}
      </div>
    </>
  );
}
