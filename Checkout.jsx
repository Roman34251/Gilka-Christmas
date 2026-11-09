import React, { useEffect, useRef, useState } from "react";
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
    [delivery, setDelivery] = useState("branch"),
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
            city: fields.city,
            point: fields.point,
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
              <span>02</span> Доставка Новою поштою
            </legend>
            <div className="radio-options">
              <label>
                <input
                  type="radio"
                  name="delivery"
                  checked={delivery === "branch"}
                  onChange={() => setDelivery("branch")}
                />
                У відділення
              </label>
              <label>
                <input
                  type="radio"
                  name="delivery"
                  disabled={hasFood}
                  checked={delivery === "locker"}
                  onChange={() => setDelivery("locker")}
                />
                У поштомат
              </label>
            </div>
            <div className="form-grid">
              <label>
                Місто / населений пункт *
                <input
                  required
                  name="city"
                  minLength="2"
                  maxLength="100"
                  autoComplete="address-level2"
                  placeholder="Наприклад, Київ"
                />
              </label>
              <label>
                {delivery === "locker"
                  ? "Номер і адреса поштомата"
                  : "Номер і адреса відділення"}{" "}
                *
                <input
                  required
                  name="point"
                  minLength="1"
                  maxLength="200"
                  placeholder="№ та вулиця"
                />
              </label>
            </div>
            <p className="muted">
              Вкажіть дані точки отримання вручну. Перевіримо їх перед
              відправленням. Доставка оплачується окремо за тарифами Нової
              пошти.
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
