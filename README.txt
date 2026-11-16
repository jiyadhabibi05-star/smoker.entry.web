smoker.entry.web — Tiiny.site Free static package

FILES
- index.html : public ebook storefront
- admin.html : admin dashboard

IMPORTANT
Tiiny.site Free hosts static files only. This package publishes the website interface, but checkout, order creation, payment-proof uploads, admin actions, ebook delivery, and database access require the Node.js backend to be deployed separately.

BEFORE USING THE SITE
1. Deploy the existing Node.js backend on a host that supports Node.js.
2. Set the backend environment variables and connect it to the Supabase/Postgres database as described in the backend README and .env.example.
3. Configure the backend CORS_ORIGIN to include the exact Tiiny.site website origin.
4. Open index.html and admin.html and replace https://YOUR-BACKEND-DOMAIN with the real backend URL (do not add a trailing slash).
5. Upload index.html and admin.html to Tiiny.site. If Tiiny.site accepts only one ZIP, upload this ZIP; if it asks for a single HTML file, upload index.html first and publish admin.html as a separate page if supported.

Do not enter wallet addresses or admin secrets into public HTML. Configure wallets and admin credentials on the backend/admin interface only.
