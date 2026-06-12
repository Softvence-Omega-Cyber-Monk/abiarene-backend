import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Restaurant POS SaaS API</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f6efe4;
        --panel: #fffaf2;
        --text: #1f2937;
        --muted: #6b7280;
        --accent: #c25b2b;
        --accent-dark: #9f451b;
        --border: #ead9c2;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        font-family: "Trebuchet MS", "Segoe UI", sans-serif;
        background:
          radial-gradient(circle at top left, rgba(194, 91, 43, 0.14), transparent 30%),
          linear-gradient(135deg, var(--bg), #fdf8f0 55%, #f5e9d8);
        color: var(--text);
      }

      .card {
        width: min(100%, 560px);
        padding: 40px 36px;
        border: 1px solid var(--border);
        border-radius: 24px;
        background: rgba(255, 250, 242, 0.92);
        box-shadow: 0 24px 60px rgba(92, 54, 24, 0.12);
      }

      .eyebrow {
        margin: 0 0 12px;
        color: var(--accent);
        font-size: 0.82rem;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      h1 {
        margin: 0 0 12px;
        font-size: clamp(2rem, 4vw, 3rem);
        line-height: 1.02;
      }

      p {
        margin: 0 0 28px;
        color: var(--muted);
        font-size: 1rem;
        line-height: 1.7;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-bottom: 20px;
      }

      .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 200px;
        padding: 14px 20px;
        border: none;
        border-radius: 999px;
        background: var(--accent);
        color: #fff;
        font-size: 0.98rem;
        font-weight: 700;
        text-decoration: none;
        transition:
          transform 160ms ease,
          background 160ms ease,
          box-shadow 160ms ease;
        box-shadow: 0 10px 24px rgba(194, 91, 43, 0.24);
      }

      .button:hover {
        background: var(--accent-dark);
        transform: translateY(-1px);
      }

      .section-title {
        margin: 0 0 14px;
        font-size: 0.95rem;
        font-weight: 700;
        color: var(--text);
      }

      .tag-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .tag-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 10px 14px;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: #fff;
        color: var(--text);
        font-size: 0.92rem;
        font-weight: 600;
        text-decoration: none;
        transition:
          border-color 160ms ease,
          color 160ms ease,
          transform 160ms ease,
          box-shadow 160ms ease;
      }

      .tag-link:hover {
        color: var(--accent-dark);
        border-color: rgba(194, 91, 43, 0.45);
        transform: translateY(-1px);
        box-shadow: 0 8px 18px rgba(92, 54, 24, 0.08);
      }

      .hint {
        margin-top: 18px;
        font-size: 0.92rem;
        color: var(--muted);
      }
    </style>
  </head>
  <body>
    <main class="card">
      <p class="eyebrow">API Gateway</p>
      <h1>Restaurant POS SaaS API</h1>
      <p>
        This backend powers tenant, menu, order, payment, and operational flows.
        Open the interactive API documentation to test routes directly.
      </p>
      <div class="actions">
        <a class="button" href="/api/docs#/">Open API Docs</a>
      </div>
      <p class="section-title">Browse API Categories</p>
      <div class="tag-grid">
        <a class="tag-link" href="/api/docs#/Auth">Auth</a>
        <a class="tag-link" href="/api/docs#/Users">Users</a>
        <a class="tag-link" href="/api/docs#/Tenant">Tenant</a>
        <a class="tag-link" href="/api/docs#/Items">Items</a>
        <a class="tag-link" href="/api/docs#/Inventory">Inventory</a>
        <a class="tag-link" href="/api/docs#/Tables">Tables</a>
        <a class="tag-link" href="/api/docs#/Orders">Orders</a>
        <a class="tag-link" href="/api/docs#/Tickets">Tickets</a>
        <a class="tag-link" href="/api/docs#/Payments">Payments</a>
        <a class="tag-link" href="/api/docs#/Discount">Discount</a>
        <a class="tag-link" href="/api/docs#/Notifications">Notifications</a>
        <a class="tag-link" href="/api/docs#/Support">Support</a>
        <a class="tag-link" href="/api/docs#/Admin">Admin</a>
        <a class="tag-link" href="/api/docs#/Uploads">Uploads</a>
      </div>
      <div class="hint">Base API prefix: <strong>/api</strong></div>
    </main>
  </body>
</html>`;
  }
}
