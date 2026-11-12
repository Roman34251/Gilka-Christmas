import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./Brand";
import { money, productUrl } from "./catalog.mjs";
export default function Checkout({
  lines,
  total,
  ready,
  commerce,
  demo,
  path,
  clear,
}) {
  const [payment, setPayment] = useState("cod"),
    [delivery, setDelivery] = useState("novaposhta"),
    [point, setPoint] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState(null),
    [orderStatus, setOrderStatus] = useState(null);
  const requestKey = useRef(null),
    form = useRef(null),
    cleared = useRef(false);
  useEffect(() => {
    if (path === "/order") checkStatus();
  }, [path]);
  async function checkStatus() {
    setBusy(true);
    setError("");
    try {
      const id = new URLSearchParams(location.search).get("id");
      const token = sessionStorage.getItem("order-token:" + id);
      if (!id || !token)
        throw new Error(
          "Відкрийте підтвердження в тому браузері, де оформлювали замовлення, або зателефонуйте 096 646 23 64.",
        );
      const r = await fetch("/api/orders/" + encodeURIComponent(id), {
        headers: { Authorization: "Bearer " + token },
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setOrderStatus(data);
      if (["success", "cod"].includes(data.status) && !cleared.current) {
        clear();
        cleared.current = true;
      }
    } catch (e) {
      setError(e.message || "Не вдалося перевірити оплату. Спробуйте ще раз.");
    } finally {
      setBusy(false);
    }
  }
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const fields = Object.fromEntries(new FormData(e.currentTarget));
      if (!point)
        throw new Error(
          delivery === "novaposhta"
            ? "Оберіть місто й відділення Нової пошти зі списку."
            : "Вкажіть індекс відділення Укрпошти — адреса підтягнеться автоматично.",
        );
      const phoneDigits = String(fields.phone || "").replace(/[^0-9]/g, "");
      if (!/^(?:380\d{9}|0\d{9})$/.test(phoneDigits)) {
        form.current.elements.phone.focus();
        throw new Error("Вкажіть український номер телефону: +380 та 9 цифр.");
      }
      if (!requestKey.current) requestKey.current = crypto.randomUUID();
      const tokenKey = "checkout-token:" + requestKey.current;
      let token = sessionStorage.getItem(tokenKey);
      if (!token) {
        token = crypto.randomUUID() + crypto.randomUUID();
        sessionStorage.setItem(tokenKey, token);
      }
      const r = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": requestKey.current,
          "X-Order-Token": token,
        },
        body: JSON.stringify({
          customer: {
            name: fields.name,
            phone: fields.phone,
            city: point.city,
            point: point.label,
            pointId: point.id,
            comment: fields.comment,
          },
          delivery,
          payment,
          consent: fields.consent === "on",
          lines: lines.map((p) => ({ id: p.id, quantity: p.quantity })),
        }),
      });
      const data = await r.json();
      if (!r.ok)
        throw new Error(data.error || "Не вдалося зберегти замовлення.");
      sessionStorage.setItem("order-token:" + data.id, token);
      setResult(data);
      if (data.pageUrl) {
        location.assign(data.pageUrl);
      } else {
        location.assign("/order?id=" + encodeURIComponent(data.id));
      }
    } catch (e) {
      setError(
        e.message ||
          "З’єднання перервано. Спробуйте ще раз — повторне надсилання не створить дублікат.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (path === "/order")
    return (
      <section className="wrap page-section confirmation">
        <div className="confirmation-icon">
          <Icon
            name={
              orderStatus?.status === "success" || orderStatus?.status === "cod"
                ? "check"
                : "shield"
            }
          />
        </div>
        <p className="eyebrow">ГІЛКА СВЯТА</p>
        <h1>
          {orderStatus?.status === "success"
            ? "Оплату підтверджено"
            : orderStatus?.status === "cod"
              ? "Дякуємо за замовлення!"
              : "Статус вашого замовлення"}
        </h1>
        {busy && <p role="status">Перевіряємо дані замовлення…</p>}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {orderStatus && (
          <>
            <p>
              Номер замовлення:{" "}
              <strong>{orderStatus.id.slice(0, 8).toUpperCase()}</strong>
            </p>
            <p>
              За товари: <strong>{money(orderStatus.amount / 100)}</strong>
            </p>
            <p>
              {orderStatus.status === "cod"
                ? "Замовлення збережено. Зв’яжемося з вами, щоб підтвердити доставку. Оплата — при отриманні."
                : orderStatus.status === "success"
                  ? "Дякуємо! Зв’яжемося з вами щодо відправлення."
                  : ["invoice_review", "pending_invoice"].includes(
                        orderStatus.status,
                      )
                    ? "Замовлення збережено, але рахунок потребує перевірки. Не оформлюйте повторно: зателефонуйте 096 646 23 64 та назвіть номер замовлення."
                    : ["failure", "expired", "reversed"].includes(
                          orderStatus.status,
                        )
                      ? "Оплата не завершена або скасована. Зверніться до нас для уточнення подальших дій."
                      : "Підтвердження оплати ще не отримано. Якщо ви вже оплатили, оновіть статус за кілька секунд."}
            </p>
            {orderStatus.pageUrl && orderStatus.status === "created" && (
              <a className="button" href={orderStatus.pageUrl}>
                Перейти до оплати
              </a>
            )}
          </>
        )}
        <div className="confirmation-actions">
          <button
            className="button secondary"
            disabled={busy}
            onClick={checkStatus}
          >
            Оновити статус
          </button>
          <a className="button" href="/catalog">
            Повернутися до колекції
          </a>
        </div>
        <p>
          Потрібна допомога?{" "}
          <a className="text-link" href="tel:+380966462364">
            096 646 23 64
          </a>
        </p>
      </section>
    );
  if (!ready)
    return (
      <section className="wrap page-section" role="status">
        Завантажуємо кошик…
      </section>
    );
  if (!lines.length)
    return (
      <section className="wrap page-section">
        <h1>Спочатку оберіть товари</h1>
        <a className="button" href="/catalog">
          До каталогу
        </a>
      </section>
    );
  const hasFood = lines.some((p) => p.category === "treats"),
    unavailable = lines.some((p) => p.available === false),
    foodBlocked = hasFood && !commerce.foodEnabled,
    enabled = !demo && commerce.ordersEnabled && !unavailable && !foodBlocked;
  return (
    <section className="wrap page-section">
      <nav className="breadcrumb" aria-label="Навігаційний шлях">
        <a href="/cart">Кошик</a>
        <span>/</span>
        <span>Оформлення</span>
      </nav>
      <p className="eyebrow">ЗАЛИШИВСЯ ОДИН КРОК</p>
      <h1>Оформлення замовлення</h1>
      <p className="muted">Без реєстрації. Лише дані, потрібні для доставки.</p>
      <form ref={form} onSubmit={submit} className="checkout-layout">
        <div className="checkout-fields">
          <fieldset>
            <legend>
              <span>01</span> Контактні дані
            </legend>
            <div className="form-grid">
              <label>
                Ім’я та прізвище *
                <input
                  required
                  minLength="3"
                  maxLength="100"
                  name="name"
                  autoComplete="name"
                  placeholder="Ім’я та прізвище отримувача"
                />
              </label>
              <label>
                Номер телефону *
                <input
                  required
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+380 __ ___ __ __"
                  minLength="10"
                  maxLength="20"
                />
                <small>Для підтвердження й повідомлень перевізника</small>
              </label>
            </div>
          </fieldset>
          <fieldset>
            <legend>
              <span>02</span> Доставка у відділення
            </legend>
            <div className="radio-options">
              {[
                ["novaposhta", "Нова пошта"],
                ["ukrposhta", "Укрпошта"],
              ].map(([id, label]) => (
                <label key={id}>
                  <input
                    type="radio"
                    name="carrier"
                    checked={delivery === id}
                    onChange={() => {
                      setDelivery(id);
                      setPoint(null);
                    }}
                  />
                  {label}
                </label>
              ))}
            </div>
            {delivery === "novaposhta" ? (
              <NovaPoshta onChange={setPoint} />
            ) : (
              <Ukrposhta onChange={setPoint} />
            )}
            <p className="muted">
              Доставка оплачується окремо за тарифами{" "}
              {delivery === "novaposhta" ? "Нової пошти" : "Укрпошти"}.
            </p>
            {hasFood && (
              <p className="notice">
                У кошику є харчові продукти. Умови пакування, температуру та
                строк доставки погодимо з вами до відправлення.
              </p>
            )}
          </fieldset>
          <fieldset>
            <legend>
              <span>03</span> Як вам зручніше оплатити?
            </legend>
            <label className="payment-option">
              <input
                type="radio"
                name="payment"
                checked={payment === "cod"}
                onChange={() => setPayment("cod")}
              />
              <span>
                <strong>При отриманні</strong>
                <small>
                  Післяплата. Можлива додаткова комісія перевізника.
                </small>
              </span>
            </label>
            <label
              className={
                "payment-option " + (!commerce.monoEnabled ? "disabled" : "")
              }
            >
              <input
                type="radio"
                name="payment"
                checked={payment === "mono"}
                disabled={!commerce.monoEnabled}
                onChange={() => setPayment("mono")}
              />
              <span>
                <strong>Онлайн через monobank</strong>
                <small>
                  {commerce.monoEnabled
                    ? "На захищеній платіжній сторінці банку."
                    : "Незабаром. Поки оберіть оплату при отриманні."}
                </small>
              </span>
            </label>
          </fieldset>
          <label>
            Коментар до замовлення
            <textarea
              name="comment"
              maxLength="1000"
              rows="3"
              placeholder="Побажання, які нам варто врахувати"
            />
          </label>
          <label className="checkbox consent">
            <input required name="consent" type="checkbox" />
            <span>
              Погоджуюся на обробку даних для виконання замовлення відповідно до{" "}
              <a href="/privacy" target="_blank" rel="noreferrer">
                політики конфіденційності
              </a>
              .
            </span>
          </label>
        </div>
        <aside className="summary-card">
          <h2>Ваша святкова добірка</h2>
          {lines.map((p) => (
            <div className="mini-product" key={p.id}>
              <img src={p.image} alt="" />
              <div>
                <a href={productUrl(p)}>{p.name}</a>
                <small>
                  {p.quantity} × {money(p.price)}
                </small>
              </div>
              <b>{money(p.quantity * p.price)}</b>
            </div>
          ))}
          <div className="summary-total">
            <span>За товари</span>
            <strong>{money(total)}</strong>
          </div>
          <p className="muted">
            Без вартості доставки
            {payment === "cod" ? " та комісії післяплати" : ""}.
          </p>
          {!enabled && (
            <p className="notice">
              {foodBlocked
                ? "Для замовлення ікри зателефонуйте 096 646 23 64 — погодимо умови доставки."
                : unavailable
                  ? "У кошику є недоступний товар. Поверніться до кошика."
                  : demo
                    ? "Це демонстрація. Реальні замовлення не надсилаються."
                    : "Онлайн-оформлення готується до запуску. Замовлення можна узгодити за телефоном 096 646 23 64."}
            </p>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button
            className="button full"
            disabled={busy || !enabled || !!result}
            type="submit"
          >
            {busy
              ? "Зберігаємо замовлення…"
              : payment === "mono"
                ? "Перейти до оплати"
                : "Підтвердити замовлення"}
            <Icon name="arrow" />
          </button>
          <a className="text-link" href="/cart">
            Редагувати кошик
          </a>
          <p className="secure-note">
            <Icon name="shield" />
            Ваші дані потрібні лише для замовлення
          </p>
        </aside>
      </form>
    </section>
  );
}

async function getJson(url) {
  const r = await fetch(url);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "Сервіс тимчасово недоступний.");
  return data;
}
function Suggest({
  label,
  placeholder,
  value,
  setValue,
  options,
  onPick,
  hint,
  disabled,
}) {
  const [open, setOpen] = useState(false);
  return (
    <label className="suggest">
      {label} *
      <input
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && options.length > 0}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
        }}
      />
      {open && options.length > 0 && (
        <ul className="suggest-list" role="listbox">
          {options.map((o) => (
            <li
              key={o.ref}
              role="option"
              onMouseDown={(e) => {
                e.preventDefault();
                onPick(o);
                setOpen(false);
              }}
            >
              {o.name}
            </li>
          ))}
        </ul>
      )}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function NovaPoshta({ onChange }) {
  const [cityText, setCityText] = useState(""),
    [cities, setCities] = useState([]),
    [city, setCity] = useState(null),
    [branches, setBranches] = useState([]),
    [branchText, setBranchText] = useState(""),
    [branch, setBranch] = useState(null),
    [note, setNote] = useState("");
  useEffect(() => {
    if (city && cityText === city.name) return;
    setCity(null);
    if (cityText.trim().length < 2) {
      setCities([]);
      return;
    }
    const t = setTimeout(() => {
      getJson("/api/np/cities?q=" + encodeURIComponent(cityText.trim()))
        .then((list) => {
          setCities(list);
          setNote(list.length ? "" : "Населений пункт не знайдено.");
        })
        .catch((e) => setNote(e.message));
    }, 300);
    return () => clearTimeout(t);
  }, [cityText]);
  useEffect(() => {
    setBranch(null);
    setBranchText("");
    setBranches([]);
    if (!city) return;
    setNote("Завантажуємо відділення…");
    getJson("/api/np/branches?city=" + city.ref)
      .then((list) => {
        setBranches(list);
        setNote(
          list.length ? "" : "У цьому населеному пункті немає відділень.",
        );
      })
      .catch((e) => setNote(e.message));
  }, [city]);
  useEffect(() => {
    onChange(
      city && branch
        ? { city: city.name, label: branch.name, id: branch.ref }
        : null,
    );
  }, [city, branch]);
  const shown = useMemo(() => {
    if (branch && branchText === branch.name) return [];
    const q = branchText.trim().toLowerCase();
    const digits = q.replace(/[^0-9]/g, "");
    return branches
      .filter(
        (b) =>
          !q ||
          (digits && b.number === digits) ||
          b.name.toLowerCase().includes(q),
      )
      .sort((a, b) => Number(b.number === digits) - Number(a.number === digits))
      .slice(0, 40);
  }, [branches, branchText, branch]);
  return (
    <div className="form-grid">
      <Suggest
        label="Місто / населений пункт"
        placeholder="Почніть вводити, наприклад, Київ"
        value={cityText}
        setValue={setCityText}
        options={city ? [] : cities}
        onPick={(c) => {
          setCity(c);
          setCityText(c.name);
        }}
        hint={!city ? note : ""}
      />
      <Suggest
        label="Відділення"
        placeholder={city ? "Номер або вулиця" : "Спершу оберіть місто"}
        disabled={!city || !branches.length}
        value={branchText}
        setValue={(v) => {
          setBranchText(v);
          if (branch && v !== branch.name) setBranch(null);
        }}
        options={shown}
        onPick={(b) => {
          setBranch(b);
          setBranchText(b.name);
        }}
        hint={
          city
            ? note ||
              (branches.length ? branches.length + " відділень у списку" : "")
            : ""
        }
      />
    </div>
  );
}
function Ukrposhta({ onChange }) {
  const [index, setIndex] = useState(""),
    [office, setOffice] = useState(null),
    [note, setNote] = useState("");
  useEffect(() => {
    setOffice(null);
    onChange(null);
    if (!/^\d{5}$/.test(index)) {
      setNote(index ? "Індекс складається з 5 цифр." : "");
      return;
    }
    setNote("Шукаємо відділення…");
    let live = true;
    getJson("/api/ukr/office?index=" + index)
      .then((o) => {
        if (!live) return;
        setOffice(o);
        setNote("");
        onChange({
          city: o.city,
          label: o.index + " — " + o.name + ", " + o.address,
          id: o.index,
        });
      })
      .catch((e) => live && setNote(e.message));
    return () => {
      live = false;
    };
  }, [index]);
  return (
    <div className="form-grid">
      <label>
        Індекс відділення Укрпошти *
        <input
          inputMode="numeric"
          maxLength="5"
          placeholder="Наприклад, 79007"
          value={index}
          onChange={(e) => setIndex(e.target.value.replace(/[^0-9]/g, ""))}
        />
        <small>
          {note || "Індекс є на сайті Укрпошти або на вивісці відділення"}
        </small>
      </label>
      <div className="office-card" aria-live="polite">
        {office ? (
          <>
            <strong>{office.name}</strong>
            <span>
              {office.city}, {office.address}
            </span>
          </>
        ) : (
          <span className="muted">Тут з’явиться адреса відділення</span>
        )}
      </div>
    </div>
  );
}
