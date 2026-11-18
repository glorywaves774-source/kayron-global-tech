KAYRON GLOBAL TECH SERVICES — WEBSITE + ADMIN MVP

Public pages: Home, About, Services, Work (portfolio), Contact.

DESIGN
"Aurora" look: aurora background, floating glass panels, light/dark switch on every page (follows the device until chosen), gentle scroll animations (switched off for visitors who ask for reduced motion), slide-in phone menu and bottom tab bar. Files: assets/styles.css (look and motion), assets/phone-nav.css + phone-nav.js (phone menu), assets/mobile.css (phones, loaded last), assets/theme.js (light/dark), assets/admin.css (admin). Logos and icons are in assets/brand/.
Private admin: /admin.html
Backend: Node.js built-in HTTP server; JSON data store; password-protected admin session.

LOCAL RUN
1. Install Node.js 20 or later.
2. Copy .env.example to .env and set ADMIN_PASSWORD and SESSION_SECRET.
3. Export those variables in your shell (or configure them in your hosting provider).
4. Run: npm start
5. Open http://localhost:3000 and http://localhost:3000/admin.html

CONTACT ENQUIRIES
The contact form now submits to /api/enquiries and stores enquiries in DATA_DIR/site-data.json. For automatic email notifications, configure RESEND_API_KEY and EMAIL_FROM with a sender address verified in your Resend account. Notifications are sent to info@kayronglobaltech.com. Enquiries remain stored if email delivery is not configured or fails.

PORTFOLIO
Projects added in the admin dashboard appear on the public Work page (/portfolio.html), newest first, via the read-only /api/projects endpoint. Project links must be http:// or https:// addresses; an address typed without a scheme gets https:// added. On first start, the projects in portfolio-seed.json are imported once if the portfolio is empty; after that, the admin dashboard is the only place projects are managed (deleted projects are not re-imported). If no projects exist, the page shows a "case studies coming soon" message with a contact button.

ADMIN DASHBOARD
Set ADMIN_PASSWORD and SESSION_SECRET before launch. Admin can review enquiries and update their status, add/delete portfolio projects, and edit the four service names and descriptions. Admin login is at /admin.html. Use a long unique password; never publish the .env file or secrets.

RENDER DEPLOYMENT
The included render.yaml defines a Node web service and a persistent disk mounted at /var/data. Create a Render Blueprint from this repository, set ADMIN_PASSWORD, RESEND_API_KEY and EMAIL_FROM in the Render dashboard, then deploy. Persistent disk is required to retain JSON data across deploys/restarts. Confirm the current Render plan supports persistent disks before deployment.

IMPORTANT LIMITATIONS / LAUNCH CHECKLIST
- This is a lightweight first backend release using a JSON file store, suitable for a small initial site. For larger workloads or multiple server instances, migrate to managed PostgreSQL.
- Configure Resend and verify the sender domain before expecting automatic email notifications.
- Confirm company address, phone/WhatsApp, social links, team, project details, and legal/privacy text before public launch.
- Configure DNS/domain, HTTPS, backups, monitoring and spam protection review.
- Admin cookies use HttpOnly and SameSite protections. Deploy behind HTTPS and use a strong unique admin password and secret.
